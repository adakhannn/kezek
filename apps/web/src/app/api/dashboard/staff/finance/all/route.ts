// apps/web/src/app/api/dashboard/staff/finance/all/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Period = 'day' | 'month' | 'year';

export async function GET(req: Request) {
    try {
        const { supabase, bizId } = await getBizContextForManagers();

        // Получаем параметры запроса
        const { searchParams } = new URL(req.url);
        const period = (searchParams.get('period') || 'day') as Period;
        const date = searchParams.get('date') || formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

        // Определяем диапазон дат в зависимости от периода
        let dateFrom: string;
        let dateTo: string;

        if (period === 'day') {
            dateFrom = date;
            dateTo = date;
        } else if (period === 'month') {
            // Первый и последний день месяца
            const [year, month] = date.split('-');
            dateFrom = `${year}-${month}-01`;
            const lastDay = new Date(Number(year), Number(month), 0).getDate();
            dateTo = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        } else {
            // Год
            const year = date.split('-')[0];
            dateFrom = `${year}-01-01`;
            dateTo = `${year}-12-31`;
        }

        // Получаем всех сотрудников бизнеса
        const { data: staffList, error: staffError } = await supabase
            .from('staff')
            .select('id, full_name, is_active, hourly_rate, percent_master, percent_salon')
            .eq('biz_id', bizId)
            .order('full_name');

        if (staffError) {
            console.error('Error loading staff:', staffError);
            return NextResponse.json(
                { ok: false, error: staffError.message },
                { status: 500 }
            );
        }

        // Используем service client для обхода RLS, так как владелец должен видеть данные своих сотрудников
        const admin = getServiceClient();

        // Получаем все смены за период
        const { data: allShifts, error: shiftsError } = await admin
            .from('staff_shifts')
            .select('*')
            .eq('biz_id', bizId)
            .gte('shift_date', dateFrom)
            .lte('shift_date', dateTo)
            .order('shift_date', { ascending: false });

        if (shiftsError) {
            console.error('Error loading shifts:', shiftsError);
            return NextResponse.json(
                { ok: false, error: shiftsError.message },
                { status: 500 }
            );
        }

        // Получаем все позиции (клиентов) для всех смен
        const shiftIds = (allShifts || []).map(s => s.id);
        const shiftItemsMap: Record<string, Array<{
            id: string;
            client_name: string | null;
            service_name: string | null;
            service_amount: number;
            consumables_amount: number;
        }>> = {};
        
        if (shiftIds.length > 0) {
            const { data: itemsData, error: itemsError } = await admin
                .from('staff_shift_items')
                .select('id, shift_id, client_name, service_name, service_amount, consumables_amount')
                .in('shift_id', shiftIds)
                .order('created_at', { ascending: true });

            if (itemsError) {
                console.error('Error loading shift items:', itemsError);
            } else {
                // Группируем по shift_id
                for (const item of itemsData || []) {
                    const shiftId = item.shift_id;
                    if (!shiftItemsMap[shiftId]) {
                        shiftItemsMap[shiftId] = [];
                    }
                    shiftItemsMap[shiftId].push({
                        id: item.id,
                        client_name: item.client_name,
                        service_name: item.service_name,
                        service_amount: Number(item.service_amount ?? 0),
                        consumables_amount: Number(item.consumables_amount ?? 0),
                    });
                }
            }
        }

        // Группируем смены по сотрудникам и считаем статистику
        const staffStats = (staffList || []).map((staff) => {
            const staffShifts = (allShifts || []).filter((s) => s.staff_id === staff.id);
            const closedShifts = staffShifts.filter((s) => s.status === 'closed');
            const openShifts = staffShifts.filter((s) => s.status === 'open');

            let totalAmount = 0;
            let totalMaster = 0;
            let totalSalon = 0;
            let totalConsumables = 0;
            let totalLateMinutes = 0;

            // Считаем закрытые смены (используем сохраненные значения)
            for (const shift of closedShifts) {
                totalAmount += Number(shift.total_amount ?? 0);
                totalMaster += Number(shift.master_share ?? 0);
                totalSalon += Number(shift.salon_share ?? 0);
                totalConsumables += Number(shift.consumables_amount ?? 0);
                totalLateMinutes += Number(shift.late_minutes ?? 0);
            }

            // Для открытых смен динамически рассчитываем из позиций
            for (const shift of openShifts) {
                const shiftItems = shiftItemsMap[shift.id] || [];
                
                // Считаем суммы из позиций
                const shiftTotalAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
                const shiftConsumables = shiftItems.reduce((sum, item) => sum + item.consumables_amount, 0);
                
                // Получаем проценты из смены или из профиля сотрудника
                const shiftPercentMaster = Number(shift.percent_master ?? staff.percent_master ?? 60);
                const shiftPercentSalon = Number(shift.percent_salon ?? staff.percent_salon ?? 40);
                const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
                const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
                
                // Базовая доля сотрудника
                const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
                const baseSalonShare = shiftTotalAmount - baseMasterShare;
                
                // Гарантированная сумма
                const hourlyRate = shift.hourly_rate ? Number(shift.hourly_rate) : (staff.hourly_rate ? Number(staff.hourly_rate) : null);
                let guaranteedAmount = 0;
                
                if (hourlyRate && shift.opened_at) {
                    const openedAt = new Date(shift.opened_at);
                    const now = new Date();
                    const diffMs = now.getTime() - openedAt.getTime();
                    const hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
                    guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;
                }
                
                // Применяем гарантированную сумму, если она больше базовой доли
                const finalMasterShare = guaranteedAmount > baseMasterShare ? guaranteedAmount : baseMasterShare;
                const topupAmount = guaranteedAmount > baseMasterShare ? (guaranteedAmount - baseMasterShare) : 0;
                const finalSalonShare = baseSalonShare - topupAmount;
                
                totalAmount += shiftTotalAmount;
                totalMaster += finalMasterShare;
                totalSalon += Math.max(0, finalSalonShare);
                totalConsumables += shiftConsumables;
                totalLateMinutes += Number(shift.late_minutes ?? 0);
            }

            return {
                staffId: staff.id,
                staffName: staff.full_name,
                isActive: staff.is_active,
                shiftsCount: staffShifts.length,
                openShiftsCount: openShifts.length,
                closedShiftsCount: closedShifts.length,
                totalAmount,
                totalMaster,
                totalSalon,
                totalConsumables,
                totalLateMinutes,
            };
        });

        // Считаем общую статистику
        const totalStats = {
            totalAmount: staffStats.reduce((sum, s) => sum + s.totalAmount, 0),
            totalMaster: staffStats.reduce((sum, s) => sum + s.totalMaster, 0),
            totalSalon: staffStats.reduce((sum, s) => sum + s.totalSalon, 0),
            totalConsumables: staffStats.reduce((sum, s) => sum + s.totalConsumables, 0),
            totalLateMinutes: staffStats.reduce((sum, s) => sum + s.totalLateMinutes, 0),
            totalShifts: staffStats.reduce((sum, s) => sum + s.shiftsCount, 0),
            totalOpenShifts: staffStats.reduce((sum, s) => sum + s.openShiftsCount, 0),
            totalClosedShifts: staffStats.reduce((sum, s) => sum + s.closedShiftsCount, 0),
        };

        return NextResponse.json({
            ok: true,
            period,
            dateFrom,
            dateTo,
            staffStats,
            totalStats,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[dashboard/staff/finance/all] error:', e);
        return NextResponse.json(
            { ok: false, error: msg },
            { status: 500 }
        );
    }
}

