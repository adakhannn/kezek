// apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { logDebug, logError } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Period = 'day' | 'month' | 'year';

type ShiftItem = {
    id: string;
    client_name: string;
    service_name: string;
    service_amount: number;
    consumables_amount: number;
    note: string | null;
    booking_id: string | null;
    created_at: string | null;
};

export async function GET(
    req: Request,
    context: unknown
) {
    try {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const staffId = await getRouteParamUuid(context, 'id');
        const { supabase, bizId } = await getBizContextForManagers();

        // Получаем параметры запроса
        const { searchParams } = new URL(req.url);
        const period = (searchParams.get('period') || 'day') as Period;
        const dateParam = searchParams.get('date');
        let date: string;
        
        if (dateParam) {
            // Валидация формата даты в зависимости от периода
            if (period === 'day') {
                // Для дня требуется полная дата YYYY-MM-DD
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(dateParam)) {
                    logError('StaffFinanceStats', 'Invalid date format for day period', { dateParam, period });
                    return NextResponse.json(
                        { ok: false, error: 'Invalid date format. Expected YYYY-MM-DD for day period' },
                        { status: 400 }
                    );
                }
                
                const [year, month, day] = dateParam.split('-').map(Number);
                
                // Валидация значений даты
                if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
                    logError('StaffFinanceStats', 'Invalid date values', { dateParam, year, month, day });
                    return NextResponse.json(
                        { ok: false, error: 'Invalid date values' },
                        { status: 400 }
                    );
                }
                
                // Проверяем диапазоны значений
                if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
                    logError('StaffFinanceStats', 'Date out of valid range', { dateParam, year, month, day });
                    return NextResponse.json(
                        { ok: false, error: 'Date out of valid range' },
                        { status: 400 }
                    );
                }
                
                // Проверяем, что дата валидна
                const testDate = new Date(year, month - 1, day);
                if (testDate.getFullYear() !== year || 
                    testDate.getMonth() !== month - 1 || 
                    testDate.getDate() !== day) {
                    logError('StaffFinanceStats', 'Invalid date (e.g., Feb 30)', { dateParam, year, month, day });
                    return NextResponse.json(
                        { ok: false, error: 'Invalid date (e.g., day does not exist in month)' },
                        { status: 400 }
                    );
                }
            } else if (period === 'month') {
                // Для месяца требуется YYYY-MM
                const monthRegex = /^\d{4}-\d{2}$/;
                if (!monthRegex.test(dateParam)) {
                    logError('StaffFinanceStats', 'Invalid date format for month period', { dateParam, period });
                    return NextResponse.json(
                        { ok: false, error: 'Invalid date format. Expected YYYY-MM for month period' },
                        { status: 400 }
                    );
                }
                
                const [year, month] = dateParam.split('-').map(Number);
                
                if (!Number.isFinite(year) || !Number.isFinite(month)) {
                    logError('StaffFinanceStats', 'Invalid month values', { dateParam, year, month });
                    return NextResponse.json(
                        { ok: false, error: 'Invalid month values' },
                        { status: 400 }
                    );
                }
                
                if (year < 1900 || year > 2100 || month < 1 || month > 12) {
                    logError('StaffFinanceStats', 'Month out of valid range', { dateParam, year, month });
                    return NextResponse.json(
                        { ok: false, error: 'Month out of valid range' },
                        { status: 400 }
                    );
                }
            } else if (period === 'year') {
                // Для года требуется YYYY
                const yearRegex = /^\d{4}$/;
                if (!yearRegex.test(dateParam)) {
                    logError('StaffFinanceStats', 'Invalid date format for year period', { dateParam, period });
                    return NextResponse.json(
                        { ok: false, error: 'Invalid date format. Expected YYYY for year period' },
                        { status: 400 }
                    );
                }
                
                const year = Number(dateParam);
                
                if (!Number.isFinite(year)) {
                    logError('StaffFinanceStats', 'Invalid year value', { dateParam, year });
                    return NextResponse.json(
                        { ok: false, error: 'Invalid year value' },
                        { status: 400 }
                    );
                }
                
                if (year < 1900 || year > 2100) {
                    logError('StaffFinanceStats', 'Year out of valid range', { dateParam, year });
                    return NextResponse.json(
                        { ok: false, error: 'Year out of valid range' },
                        { status: 400 }
                    );
                }
            }
            
            date = dateParam;
        } else {
            date = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
        }

        // Проверяем, что сотрудник принадлежит этому бизнесу
        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, biz_id, full_name')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError) {
            logError('StaffFinanceStats', 'Error loading staff', { 
                error: staffError.message, 
                staffId,
                bizId 
            });
            return NextResponse.json(
                { ok: false, error: 'Staff not found or access denied' },
                { status: 404 }
            );
        }

        if (!staff) {
            logDebug('StaffFinanceStats', 'Staff not found', { staffId, bizId });
            return NextResponse.json(
                { ok: false, error: 'Staff not found or access denied' },
                { status: 404 }
            );
        }

        // Нормализуем значения для надежного сравнения
        const normalizedBizId = bizId ? String(bizId).trim() : null;
        const normalizedStaffBizId = staff.biz_id != null ? String(staff.biz_id).trim() : null;

        // Проверяем принадлежность к бизнесу
        if (!normalizedStaffBizId || !normalizedBizId || normalizedStaffBizId !== normalizedBizId) {
            logError('StaffFinanceStats', 'Staff business mismatch', {
                staffId,
                staffBizId: normalizedStaffBizId,
                requestedBizId: normalizedBizId,
                staffBizIdType: typeof staff.biz_id,
                bizIdType: typeof bizId,
            });
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

        logDebug('StaffFinanceStats', 'Loading shifts', {
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

        logDebug('StaffFinanceStats', 'Today open shift', { hasOpenShift: !!todayOpenShift });

        const { data: shifts, error: shiftsError } = await admin
            .from('staff_shifts')
            .select('*, staff:staff_id (hourly_rate, percent_master, percent_salon)')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .gte('shift_date', dateFrom)
            .lte('shift_date', dateTo)
            .order('shift_date', { ascending: false });

        if (shiftsError) {
            logError('StaffFinanceStats', 'Error loading shifts', shiftsError);
            return NextResponse.json(
                { ok: false, error: shiftsError.message },
                { status: 500 }
            );
        }

        logDebug('StaffFinanceStats', 'Found shifts', { count: shifts?.length || 0, shifts });
        if (shifts && shifts.length > 0) {
            logDebug('StaffFinanceStats', 'Shift dates', shifts.map(s => ({ date: s.shift_date, status: s.status })));
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
                    logDebug('StaffFinanceStats', 'Added today open shift to results');
                }
            } else if (period !== 'day') {
                // Для месяца/года добавляем открытую смену на сегодня, если её нет в результатах
                const hasTodayShift = finalShifts.some(s => s.id === todayOpenShift.id);
                if (!hasTodayShift) {
                    finalShifts = [todayOpenShift, ...finalShifts];
                    logDebug('StaffFinanceStats', 'Added today open shift to results for period view');
                }
            }
        }

        // Получаем позиции (клиентов) для всех смен
        // Используем service client для обхода RLS, так как владелец должен видеть данные своих сотрудников
        const shiftIds = (finalShifts || []).map(s => s.id);
        const shiftItemsMap: Record<string, ShiftItem[]> = {};
        
        if (shiftIds.length > 0) {
            const { data: itemsData, error: itemsError } = await admin
                .from('staff_shift_items')
                .select('id, shift_id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at')
                .in('shift_id', shiftIds)
                .order('created_at', { ascending: true });

            if (itemsError) {
                logError('StaffFinanceStats', 'Error loading shift items', itemsError);
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
                        created_at: item.created_at ?? null,
                    } as ShiftItem);
                }
            }
        }

        // Считаем статистику
        const closedShifts = finalShifts?.filter(s => s.status === 'closed') || [];
        const openShifts = finalShifts?.filter(s => s.status === 'open') || [];

        // Рассчитываем детали для открытых смен (для отображения разбивки)
        let totalBaseMasterShare = 0; // Базовая доля сотрудника (без гарантированной суммы)
        let totalGuaranteedAmount = 0; // Гарантированная сумма за выход
        let hasGuaranteedPayment = false; // Есть ли гарантированная оплата, превышающая базовую долю
        
        for (const shift of openShifts) {
            const shiftItems = shiftItemsMap[shift.id] || [];
            const shiftTotalAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
            
            // Получаем проценты
            const shiftPercentMaster = Number(shift.percent_master ?? 60);
            const shiftPercentSalon = Number(shift.percent_salon ?? 40);
            const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
            const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
            
            // Базовая доля
            const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
            totalBaseMasterShare += baseMasterShare;
            
            // Гарантированная сумма
            const staffData = (shift as { staff?: { hourly_rate?: number | null } | null }).staff;
            const hourlyRate = shift.hourly_rate ? Number(shift.hourly_rate) : (staffData?.hourly_rate ? Number(staffData.hourly_rate) : null);
            
            if (hourlyRate && shift.opened_at) {
                const openedAt = new Date(shift.opened_at);
                const now = new Date();
                const diffMs = now.getTime() - openedAt.getTime();
                const hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
                const guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;
                totalGuaranteedAmount += guaranteedAmount;
                
                if (guaranteedAmount > baseMasterShare) {
                    hasGuaranteedPayment = true;
                }
            }
        }

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
            // Детали расчета для открытых смен
            totalBaseMasterShare, // Базовая доля (без гарантированной суммы)
            totalGuaranteedAmount, // Гарантированная сумма за выход
            hasGuaranteedPayment, // Есть ли гарантированная оплата, превышающая базовую долю
            shifts: finalShifts?.map(s => {
                // Для всех смен (и открытых, и закрытых) пересчитываем суммы из позиций
                // Это важно, так как в БД могут быть старые/неправильные значения
                const shiftItems = shiftItemsMap[s.id] || [];
                const shiftTotalAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
                const shiftConsumables = shiftItems.reduce((sum, item) => sum + item.consumables_amount, 0);
                
                let displayTotalAmount = shiftTotalAmount;
                let displayMasterShare = Number(s.master_share ?? 0);
                let displaySalonShare = Number(s.salon_share ?? 0);
                
                // Получаем hourly_rate из связанной таблицы staff, если его нет в shift
                const staffData = (s as { staff?: { hourly_rate?: number | null; percent_master?: number | null; percent_salon?: number | null } | null }).staff;
                const hourlyRate = s.hourly_rate ? Number(s.hourly_rate) : (staffData?.hourly_rate ? Number(staffData.hourly_rate) : null);
                const staffPercentMaster = staffData?.percent_master ? Number(staffData.percent_master) : null;
                const staffPercentSalon = staffData?.percent_salon ? Number(staffData.percent_salon) : null;
                
                // Получаем проценты из shift, staff или используем дефолтные
                const shiftPercentMaster = Number(s.percent_master ?? staffPercentMaster ?? 60);
                const shiftPercentSalon = Number(s.percent_salon ?? staffPercentSalon ?? 40);
                const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
                const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
                const normalizedSalon = (shiftPercentSalon / percentSum) * 100;
                
                // Базовая доля сотрудника от выручки
                const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
                const baseSalonShare = Math.round((shiftTotalAmount * normalizedSalon) / 100) + shiftConsumables;
                
                if (s.status === 'open') {
                    // Для открытых смен проверяем гарантированную сумму
                    if (hourlyRate && s.opened_at) {
                        const openedAt = new Date(s.opened_at);
                        const now = new Date();
                        const diffMs = now.getTime() - openedAt.getTime();
                        const hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
                        const guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;
                        
                        logDebug('StaffFinanceStats', 'Open shift calculation', {
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
                            logDebug('StaffFinanceStats', 'Using guaranteed amount', {
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
                } else {
                    // Для закрытых смен используем пересчитанные значения из items
                    // Если в БД есть гарантированная сумма, учитываем её
                    const dbGuaranteedAmount = Number(s.guaranteed_amount ?? 0);
                    const dbHoursWorked = s.hours_worked ? Number(s.hours_worked) : null;
                    
                    // Если есть гарантированная сумма в БД и она больше базовой доли, используем её
                    if (dbGuaranteedAmount > 0 && dbGuaranteedAmount > baseMasterShare) {
                        displayMasterShare = dbGuaranteedAmount;
                        const topupAmount = displayMasterShare - baseMasterShare;
                        displaySalonShare = Math.max(0, baseSalonShare - topupAmount);
                    } else {
                        // Иначе используем пересчитанные значения из items
                        displayMasterShare = baseMasterShare;
                        displaySalonShare = baseSalonShare;
                    }
                    
                    logDebug('StaffFinanceStats', 'Closed shift calculation', {
                        shiftId: s.id,
                        shiftDate: s.shift_date,
                        shiftTotalAmount,
                        itemsCount: shiftItems.length,
                        baseMasterShare,
                        baseSalonShare,
                        dbGuaranteedAmount,
                        dbHoursWorked,
                        displayMasterShare,
                        displaySalonShare,
                    });
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
                
                // Создаем items с явным типом ShiftItem[] (используем уже объявленную переменную shiftItems)
                const shiftItemsTyped: ShiftItem[] = shiftItems.map((item): ShiftItem => ({
                    id: item.id,
                    client_name: item.client_name || '',
                    service_name: item.service_name || '',
                    service_amount: item.service_amount,
                    consumables_amount: item.consumables_amount,
                    note: item.note || null,
                    booking_id: item.booking_id || null,
                    created_at: item.created_at ?? null,
                }));
                
                return {
                    id: s.id,
                    shift_date: s.shift_date,
                    status: s.status,
                    opened_at: s.opened_at,
                    closed_at: s.closed_at,
                    total_amount: displayTotalAmount,
                    consumables_amount: shiftConsumables, // Используем пересчитанное значение из items
                    master_share: displayMasterShare,
                    salon_share: displaySalonShare,
                    late_minutes: Number(s.late_minutes ?? 0),
                    hours_worked: displayHoursWorked,
                    hourly_rate: displayHourlyRate,
                    guaranteed_amount: displayGuaranteedAmount,
                    items: shiftItemsTyped,
                };
            }) || [],
        };

        // Суммируем итоги, используя уже пересчитанные значения из stats.shifts
        // Это важно, чтобы гарантированная сумма учитывалась правильно
        logDebug('StaffFinanceStats', 'Calculating totals from shifts', { count: stats.shifts.length });
        for (const shift of stats.shifts) {
            const prevTotalMaster = stats.totalMaster;
            const prevTotalSalon = stats.totalSalon;
            
            stats.totalAmount += shift.total_amount;
            stats.totalMaster += shift.master_share; // Уже включает гарантированную сумму, если она больше базовой доли
            stats.totalSalon += shift.salon_share; // Уже скорректирована с учетом доплаты за выход
            stats.totalConsumables += shift.consumables_amount;
            stats.totalLateMinutes += shift.late_minutes;
            
            if (shift.status === 'open') {
                logDebug('StaffFinanceStats', 'Open shift totals', {
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
        
        logDebug('StaffFinanceStats', 'Final totals', {
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
        logError('StaffFinanceStats', 'Unexpected error', e);
        return NextResponse.json(
            { ok: false, error: msg },
            { status: 500 }
        );
    }
}

