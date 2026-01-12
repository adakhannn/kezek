// apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Period = 'day' | 'month' | 'year';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: staffId } = await params;
        const { supabase, bizId } = await getBizContextForManagers();

        // Получаем параметры запроса
        const { searchParams } = new URL(req.url);
        const period = (searchParams.get('period') || 'day') as Period;
        const date = searchParams.get('date') || formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

        // Проверяем, что сотрудник принадлежит этому бизнесу
        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, biz_id, full_name')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError || !staff || String(staff.biz_id) !== String(bizId)) {
            return NextResponse.json(
                { ok: false, error: 'Staff not found or access denied' },
                { status: 404 }
            );
        }

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

        // Получаем смены за период
        console.log('[dashboard/staff/finance/stats] Loading shifts:', {
            staffId,
            bizId,
            dateFrom,
            dateTo,
            period,
            date,
        });

        const { data: shifts, error: shiftsError } = await supabase
            .from('staff_shifts')
            .select('*')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .gte('shift_date', dateFrom)
            .lte('shift_date', dateTo)
            .order('shift_date', { ascending: false });

        if (shiftsError) {
            console.error('[dashboard/staff/finance/stats] Error loading shifts:', shiftsError);
            return NextResponse.json(
                { ok: false, error: shiftsError.message },
                { status: 500 }
            );
        }

        console.log('[dashboard/staff/finance/stats] Found shifts:', shifts?.length || 0, shifts);

        // Получаем позиции (клиентов) для всех смен
        const shiftIds = (shifts || []).map(s => s.id);
        const shiftItemsMap: Record<string, Array<{
            id: string;
            client_name: string | null;
            service_name: string | null;
            service_amount: number;
            consumables_amount: number;
            note: string | null;
            booking_id: string | null;
        }>> = {};
        
        if (shiftIds.length > 0) {
            const { data: itemsData, error: itemsError } = await supabase
                .from('staff_shift_items')
                .select('id, shift_id, client_name, service_name, service_amount, consumables_amount, note, booking_id')
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
                        note: item.note,
                        booking_id: item.booking_id,
                    });
                }
            }
        }

        // Считаем статистику
        const closedShifts = shifts?.filter(s => s.status === 'closed') || [];
        const openShifts = shifts?.filter(s => s.status === 'open') || [];

        const stats = {
            period,
            dateFrom,
            dateTo,
            staffName: staff.full_name,
            shiftsCount: shifts?.length || 0,
            openShiftsCount: openShifts.length,
            closedShiftsCount: closedShifts.length,
            totalAmount: 0, // Общий оборот
            totalMaster: 0, // Доля сотрудника
            totalSalon: 0, // Доля бизнеса
            totalConsumables: 0, // Расходники
            totalLateMinutes: 0,
            totalClients: Object.values(shiftItemsMap).reduce(
                (sum, items) => sum + items.length,
                0
            ),
            shifts: shifts?.map(s => {
                // Для открытых смен пересчитываем суммы из позиций
                let displayTotalAmount = Number(s.total_amount ?? 0);
                let displayMasterShare = Number(s.master_share ?? 0);
                let displaySalonShare = Number(s.salon_share ?? 0);
                
                if (s.status === 'open') {
                    const shiftItems = shiftItemsMap[s.id] || [];
                    const shiftTotalAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
                    const shiftConsumables = shiftItems.reduce((sum, item) => sum + item.consumables_amount, 0);
                    
                    displayTotalAmount = shiftTotalAmount;
                    
                    // Получаем проценты из shift или используем дефолтные
                    const shiftPercentMaster = Number(s.percent_master ?? 60);
                    const shiftPercentSalon = Number(s.percent_salon ?? 40);
                    const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
                    const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
                    const normalizedSalon = (shiftPercentSalon / percentSum) * 100;
                    
                    // Базовая доля сотрудника от выручки
                    const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
                    const baseSalonShare = Math.round((shiftTotalAmount * normalizedSalon) / 100) + shiftConsumables;
                    
                    // Проверяем, есть ли гарантированная сумма (оплата за выход)
                    if (s.hourly_rate && s.opened_at) {
                        const openedAt = new Date(s.opened_at);
                        const now = new Date();
                        const diffMs = now.getTime() - openedAt.getTime();
                        const hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
                        const guaranteedAmount = hoursWorked * Number(s.hourly_rate);
                        
                        // Если гарантированная сумма больше базовой доли, используем гарантию
                        if (guaranteedAmount > baseMasterShare) {
                            displayMasterShare = Math.round(guaranteedAmount * 100) / 100;
                            const topupAmount = displayMasterShare - baseMasterShare;
                            displaySalonShare = baseSalonShare - topupAmount;
                        } else {
                            displayMasterShare = baseMasterShare;
                            displaySalonShare = baseSalonShare;
                        }
                    } else {
                        displayMasterShare = baseMasterShare;
                        displaySalonShare = baseSalonShare;
                    }
                }
                
                return {
                    id: s.id,
                    shift_date: s.shift_date,
                    status: s.status,
                    opened_at: s.opened_at,
                    closed_at: s.closed_at,
                    total_amount: displayTotalAmount,
                    consumables_amount: Number(s.consumables_amount ?? 0),
                    master_share: displayMasterShare,
                    salon_share: displaySalonShare,
                    late_minutes: Number(s.late_minutes ?? 0),
                    items: (shiftItemsMap[s.id] || []).map((item) => ({
                        id: item.id,
                        client_name: item.client_name || '',
                        service_name: item.service_name || '',
                        service_amount: item.service_amount,
                        consumables_amount: item.consumables_amount,
                        note: item.note || null,
                        booking_id: item.booking_id || null,
                    })),
                };
            }) || [],
        };

        // Суммируем только закрытые смены
        for (const shift of closedShifts) {
            stats.totalAmount += Number(shift.total_amount ?? 0);
            stats.totalMaster += Number(shift.master_share ?? 0);
            stats.totalSalon += Number(shift.salon_share ?? 0);
            stats.totalConsumables += Number(shift.consumables_amount ?? 0);
            stats.totalLateMinutes += Number(shift.late_minutes ?? 0);
        }

        // Для открытых смен считаем текущие значения из позиций (актуальные данные)
        for (const shift of openShifts) {
            // Для открытых смен пересчитываем суммы из позиций, чтобы показать актуальные данные
            const shiftItems = shiftItemsMap[shift.id] || [];
            const shiftTotalAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
            const shiftConsumables = shiftItems.reduce((sum, item) => sum + item.consumables_amount, 0);
            
            // Получаем проценты из shift или используем дефолтные
            const shiftPercentMaster = Number(shift.percent_master ?? 60);
            const shiftPercentSalon = Number(shift.percent_salon ?? 40);
            const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
            const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
            const normalizedSalon = (shiftPercentSalon / percentSum) * 100;
            
            // Базовая доля сотрудника от выручки
            const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
            const baseSalonShare = Math.round((shiftTotalAmount * normalizedSalon) / 100) + shiftConsumables;
            
            // Проверяем, есть ли гарантированная сумма (оплата за выход)
            let finalMasterShare = baseMasterShare;
            let finalSalonShare = baseSalonShare;
            
            if (shift.hourly_rate && shift.opened_at) {
                const openedAt = new Date(shift.opened_at);
                const now = new Date();
                const diffMs = now.getTime() - openedAt.getTime();
                const hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
                const guaranteedAmount = hoursWorked * Number(shift.hourly_rate);
                
                // Если гарантированная сумма больше базовой доли, используем гарантию
                if (guaranteedAmount > baseMasterShare) {
                    finalMasterShare = Math.round(guaranteedAmount * 100) / 100;
                    const topupAmount = finalMasterShare - baseMasterShare;
                    finalSalonShare = baseSalonShare - topupAmount;
                }
            }
            
            stats.totalAmount += shiftTotalAmount;
            stats.totalMaster += finalMasterShare;
            stats.totalSalon += finalSalonShare;
            stats.totalConsumables += shiftConsumables;
            stats.totalLateMinutes += Number(shift.late_minutes ?? 0);
        }

        return NextResponse.json({
            ok: true,
            stats,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[dashboard/staff/finance/stats] error:', e);
        return NextResponse.json(
            { ok: false, error: msg },
            { status: 500 }
        );
    }
}

