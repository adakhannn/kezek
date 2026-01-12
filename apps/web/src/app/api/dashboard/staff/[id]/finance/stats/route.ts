// apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';
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

        // Используем service client для обхода RLS, так как владелец должен видеть данные своих сотрудников
        const admin = getServiceClient();

        // Сначала проверим, есть ли открытая смена на сегодня
        // Это важно, потому что открытая смена должна показываться
        const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
        const { data: todayOpenShift } = await admin
            .from('staff_shifts')
            .select('*')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('shift_date', today)
            .eq('status', 'open')
            .maybeSingle();

        console.log('[dashboard/staff/finance/stats] Today open shift:', todayOpenShift);

        // Сначала проверим, есть ли вообще смены у этого сотрудника
        const { data: allShiftsCheck, error: checkError } = await admin
            .from('staff_shifts')
            .select('id, shift_date, status')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .order('shift_date', { ascending: false })
            .limit(5);

        console.log('[dashboard/staff/finance/stats] All shifts check (last 5):', allShiftsCheck);

        const { data: shifts, error: shiftsError } = await admin
            .from('staff_shifts')
            .select('*, staff:staff_id (hourly_rate, percent_master, percent_salon)')
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
        if (shifts && shifts.length > 0) {
            console.log('[dashboard/staff/finance/stats] Shift dates:', shifts.map(s => ({ date: s.shift_date, status: s.status })));
        }

        // Если есть открытая смена на сегодня, но она не попадает в выбранный период,
        // добавляем её в результаты (для периода "день" это нужно, если смотрим на сегодня)
        let finalShifts = shifts || [];
        if (todayOpenShift) {
            // Если смотрим на сегодня и есть открытая смена - она должна быть в результатах
            if (period === 'day' && date === today) {
                const hasTodayShift = finalShifts.some(s => s.id === todayOpenShift.id);
                if (!hasTodayShift) {
                    finalShifts = [todayOpenShift, ...finalShifts];
                    console.log('[dashboard/staff/finance/stats] Added today open shift to results');
                }
            } else if (period !== 'day') {
                // Для месяца/года добавляем открытую смену на сегодня, если её нет в результатах
                const hasTodayShift = finalShifts.some(s => s.id === todayOpenShift.id);
                if (!hasTodayShift) {
                    finalShifts = [todayOpenShift, ...finalShifts];
                    console.log('[dashboard/staff/finance/stats] Added today open shift to results for period view');
                }
            }
        }

        // Получаем позиции (клиентов) для всех смен
        // Используем service client для обхода RLS, так как владелец должен видеть данные своих сотрудников
        const shiftIds = (finalShifts || []).map(s => s.id);
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
            const { data: itemsData, error: itemsError } = await admin
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
        const closedShifts = finalShifts?.filter(s => s.status === 'closed') || [];
        const openShifts = finalShifts?.filter(s => s.status === 'open') || [];

        const stats = {
            period,
            dateFrom,
            dateTo,
            staffName: staff.full_name,
            shiftsCount: finalShifts?.length || 0,
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
            shifts: finalShifts?.map(s => {
                // Для открытых смен пересчитываем суммы из позиций
                let displayTotalAmount = Number(s.total_amount ?? 0);
                let displayMasterShare = Number(s.master_share ?? 0);
                let displaySalonShare = Number(s.salon_share ?? 0);
                
                // Получаем hourly_rate из связанной таблицы staff, если его нет в shift
                const staffData = (s as { staff?: { hourly_rate?: number | null; percent_master?: number | null; percent_salon?: number | null } | null }).staff;
                const hourlyRate = s.hourly_rate ? Number(s.hourly_rate) : (staffData?.hourly_rate ? Number(staffData.hourly_rate) : null);
                const staffPercentMaster = staffData?.percent_master ? Number(staffData.percent_master) : null;
                const staffPercentSalon = staffData?.percent_salon ? Number(staffData.percent_salon) : null;
                
                if (s.status === 'open') {
                    const shiftItems = shiftItemsMap[s.id] || [];
                    const shiftTotalAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
                    const shiftConsumables = shiftItems.reduce((sum, item) => sum + item.consumables_amount, 0);
                    
                    displayTotalAmount = shiftTotalAmount;
                    
                    // Получаем проценты из shift, staff или используем дефолтные
                    const shiftPercentMaster = Number(s.percent_master ?? staffPercentMaster ?? 60);
                    const shiftPercentSalon = Number(s.percent_salon ?? staffPercentSalon ?? 40);
                    const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
                    const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
                    const normalizedSalon = (shiftPercentSalon / percentSum) * 100;
                    
                    // Базовая доля сотрудника от выручки
                    const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
                    const baseSalonShare = Math.round((shiftTotalAmount * normalizedSalon) / 100) + shiftConsumables;
                    
                    // Проверяем, есть ли гарантированная сумма (оплата за выход)
                    if (hourlyRate && s.opened_at) {
                        const openedAt = new Date(s.opened_at);
                        const now = new Date();
                        const diffMs = now.getTime() - openedAt.getTime();
                        const hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
                        const guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;
                        
                        console.log('[dashboard/staff/finance/stats] Open shift calculation:', {
                            shiftId: s.id,
                            shiftTotalAmount,
                            baseMasterShare,
                            hoursWorked,
                            hourlyRate,
                            guaranteedAmount,
                            willUseGuaranteed: guaranteedAmount > baseMasterShare,
                        });
                        
                        // Если гарантированная сумма больше базовой доли, используем гарантию
                        if (guaranteedAmount > baseMasterShare) {
                            displayMasterShare = guaranteedAmount;
                            const topupAmount = displayMasterShare - baseMasterShare;
                            displaySalonShare = Math.max(0, baseSalonShare - topupAmount);
                            console.log('[dashboard/staff/finance/stats] Using guaranteed amount:', {
                                displayMasterShare,
                                topupAmount,
                                displaySalonShare,
                            });
                        } else {
                            displayMasterShare = baseMasterShare;
                            displaySalonShare = baseSalonShare;
                        }
                    } else {
                        displayMasterShare = baseMasterShare;
                        displaySalonShare = baseSalonShare;
                    }
                }
                
                // Рассчитываем guaranteed_amount и hours_worked
                let displayGuaranteedAmount = Number(s.guaranteed_amount ?? 0);
                let displayHoursWorked: number | null = Number(s.hours_worked ?? null);
                const displayHourlyRate: number | null = hourlyRate;
                
                if (s.status === 'open' && hourlyRate && s.opened_at) {
                    // Для открытых смен пересчитываем на основе текущего времени
                    const openedAt = new Date(s.opened_at);
                    const now = new Date();
                    const diffMs = now.getTime() - openedAt.getTime();
                    displayHoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
                    displayGuaranteedAmount = Math.round(displayHoursWorked * hourlyRate * 100) / 100;
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
                    hours_worked: displayHoursWorked,
                    hourly_rate: displayHourlyRate,
                    guaranteed_amount: displayGuaranteedAmount,
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

        // Суммируем итоги, используя уже пересчитанные значения из stats.shifts
        // Это важно, чтобы гарантированная сумма учитывалась правильно
        console.log('[dashboard/staff/finance/stats] Calculating totals from shifts:', stats.shifts.length);
        for (const shift of stats.shifts) {
            const prevTotalMaster = stats.totalMaster;
            const prevTotalSalon = stats.totalSalon;
            
            stats.totalAmount += shift.total_amount;
            stats.totalMaster += shift.master_share; // Уже включает гарантированную сумму, если она больше базовой доли
            stats.totalSalon += shift.salon_share; // Уже скорректирована с учетом доплаты за выход
            stats.totalConsumables += shift.consumables_amount;
            stats.totalLateMinutes += shift.late_minutes;
            
            if (shift.status === 'open') {
                console.log('[dashboard/staff/finance/stats] Open shift totals:', {
                    shiftId: shift.id,
                    shiftDate: shift.shift_date,
                    totalAmount: shift.total_amount,
                    masterShare: shift.master_share,
                    salonShare: shift.salon_share,
                    guaranteedAmount: shift.guaranteed_amount,
                    hoursWorked: shift.hours_worked,
                    hourlyRate: shift.hourly_rate,
                    addedToTotalMaster: shift.master_share,
                    addedToTotalSalon: shift.salon_share,
                    totalMasterBefore: prevTotalMaster,
                    totalMasterAfter: stats.totalMaster,
                    totalSalonBefore: prevTotalSalon,
                    totalSalonAfter: stats.totalSalon,
                });
            }
        }
        
        console.log('[dashboard/staff/finance/stats] Final totals:', {
            totalAmount: stats.totalAmount,
            totalMaster: stats.totalMaster,
            totalSalon: stats.totalSalon,
            totalConsumables: stats.totalConsumables,
        });

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

