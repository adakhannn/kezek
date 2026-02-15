// apps/web/src/app/api/dashboard/staff/finance/all/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Period = 'day' | 'month' | 'year';

type StaffFinanceStats = {
    staff_id: string;
    staff_name: string;
    is_active: boolean;
    branch_id: string;
    shifts: {
        total: number;
        closed: number;
        open: number;
    };
    stats: {
        total_amount: number;
        total_master: number;
        total_salon: number;
        total_consumables: number;
        total_late_minutes: number;
    };
};

type BusinessFinanceStatsResult = {
    staff_stats?: StaffFinanceStats[];
    total_stats?: {
        total_shifts: number;
        closed_shifts: number;
        open_shifts: number;
        total_amount: number;
        total_master: number;
        total_salon: number;
        total_consumables: number;
        total_late_minutes: number;
    };
};

export async function GET(req: Request) {
    return withErrorHandler('FinanceAll', async () => {
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
                    logError('FinanceAll', 'Invalid date format for day period', { dateParam, period });
                    return createErrorResponse('validation', 'Неверный формат даты. Ожидается YYYY-MM-DD для периода "день"', undefined, 400);
                }
                
                const [year, month, day] = dateParam.split('-').map(Number);
                
                // Валидация значений даты
                if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
                    logError('FinanceAll', 'Invalid date values', { dateParam, year, month, day });
                    return createErrorResponse('validation', 'Неверные значения даты', undefined, 400);
                }
                
                // Проверяем диапазоны значений
                if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
                    logError('FinanceAll', 'Date out of valid range', { dateParam, year, month, day });
                    return createErrorResponse('validation', 'Дата вне допустимого диапазона', undefined, 400);
                }
                
                // Проверяем, что дата валидна
                const testDate = new Date(year, month - 1, day);
                if (testDate.getFullYear() !== year || 
                    testDate.getMonth() !== month - 1 || 
                    testDate.getDate() !== day) {
                    logError('FinanceAll', 'Invalid date (e.g., Feb 30)', { dateParam, year, month, day });
                    return createErrorResponse('validation', 'Неверная дата (например, 30 февраля)', undefined, 400);
                }
            } else if (period === 'month') {
                // Для месяца требуется YYYY-MM
                const monthRegex = /^\d{4}-\d{2}$/;
                if (!monthRegex.test(dateParam)) {
                    logError('FinanceAll', 'Invalid date format for month period', { dateParam, period });
                    return createErrorResponse('validation', 'Неверный формат даты. Ожидается YYYY-MM для периода "месяц"', undefined, 400);
                }
                
                const [year, month] = dateParam.split('-').map(Number);
                
                if (!Number.isFinite(year) || !Number.isFinite(month)) {
                    logError('FinanceAll', 'Invalid month values', { dateParam, year, month });
                    return createErrorResponse('validation', 'Неверные значения месяца', undefined, 400);
                }
                
                if (year < 1900 || year > 2100 || month < 1 || month > 12) {
                    logError('FinanceAll', 'Month out of valid range', { dateParam, year, month });
                    return createErrorResponse('validation', 'Месяц вне допустимого диапазона', undefined, 400);
                }
            } else if (period === 'year') {
                // Для года требуется YYYY
                const yearRegex = /^\d{4}$/;
                if (!yearRegex.test(dateParam)) {
                    logError('FinanceAll', 'Invalid date format for year period', { dateParam, period });
                    return createErrorResponse('validation', 'Неверный формат даты. Ожидается YYYY для периода "год"', undefined, 400);
                }
                
                const year = Number(dateParam);
                
                if (!Number.isFinite(year)) {
                    logError('FinanceAll', 'Invalid year value', { dateParam, year });
                    return createErrorResponse('validation', 'Неверное значение года', undefined, 400);
                }
                
                if (year < 1900 || year > 2100) {
                    logError('FinanceAll', 'Year out of valid range', { dateParam, year });
                    return createErrorResponse('validation', 'Год вне допустимого диапазона', undefined, 400);
                }
            }
            
            date = dateParam;
        } else {
            date = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
        }
        
        const branchId = searchParams.get('branchId');

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

        // Получаем все филиалы бизнеса (для фильтра в UI)
        const { data: branches, error: branchesError } = await supabase
            .from('branches')
            .select('id, name')
            .eq('biz_id', bizId)
            .order('name');

        if (branchesError) {
            logError('FinanceAll', 'Error loading branches', branchesError);
            return createErrorResponse('internal', branchesError.message, undefined, 500);
        }

        // Получаем всех сотрудников бизнеса (с optional фильтром по филиалу)
        let staffQuery = supabase
            .from('staff')
            .select('id, full_name, is_active, hourly_rate, percent_master, percent_salon, branch_id')
            .eq('biz_id', bizId)
            .order('full_name');

        if (branchId) {
            staffQuery = staffQuery.eq('branch_id', branchId);
        }

        const { data: staffList, error: staffError } = await staffQuery;

        if (staffError) {
            logError('FinanceAll', 'Error loading staff', staffError);
            return createErrorResponse('internal', staffError.message, undefined, 500);
        }

        // Используем service client для обхода RLS, так как владелец должен видеть данные своих сотрудников
        const admin = getServiceClient();

        // Используем оптимизированную SQL функцию для получения статистики
        // Это уменьшает количество запросов к БД и выполняет агрегацию на стороне сервера
        logDebug('FinanceAll', 'Calling get_business_finance_stats', {
            bizId,
            dateFrom,
            dateTo,
            branchId: branchId || null,
        });
        
        const { data: businessStats, error: statsError } = await admin.rpc('get_business_finance_stats', {
            p_biz_id: bizId,
            p_date_from: dateFrom,
            p_date_to: dateTo,
            p_branch_id: branchId || null,
            p_include_open: true,
        });

        if (statsError) {
            logError('FinanceAll', 'Error calling get_business_finance_stats RPC', {
                error: statsError.message,
                code: statsError.code,
                details: statsError.details,
                hint: statsError.hint,
                fullError: statsError,
            });
            // Возвращаем ошибку с деталями вместо fallback
            return createErrorResponse(
                'internal',
                statsError.message || 'Не удалось получить финансовую статистику',
                { details: statsError.details, hint: statsError.hint, code: statsError.code },
                500
            );
        }
        
        logDebug('FinanceAll', 'get_business_finance_stats success', {
            hasData: !!businessStats,
            staffStatsCount: businessStats?.staff_stats?.length || 0,
        });

        // Получаем все смены для расчета открытых смен (они требуют динамического расчета)
        let shiftsQuery = admin
            .from('staff_shifts')
            .select('*')
            .eq('biz_id', bizId)
            .eq('status', 'open')
            .gte('shift_date', dateFrom)
            .lte('shift_date', dateTo);

        if (branchId) {
            shiftsQuery = shiftsQuery.eq('branch_id', branchId);
        }

        const { data: openShifts, error: openShiftsError } = await shiftsQuery;

        if (openShiftsError) {
            logError('FinanceAll', 'Error loading open shifts', openShiftsError);
        }

        // Получаем позиции для открытых смен
        const openShiftIds = (openShifts || []).map(s => s.id);
        const shiftItemsMap: Record<string, Array<{
            id: string;
            client_name: string | null;
            service_name: string | null;
            service_amount: number;
            consumables_amount: number;
        }>> = {};
        
        if (openShiftIds.length > 0) {
            const { data: itemsData, error: itemsError } = await admin
                .from('staff_shift_items')
                .select('id, shift_id, client_name, service_name, service_amount, consumables_amount')
                .in('shift_id', openShiftIds)
                .order('created_at', { ascending: true });

            if (itemsError) {
                logError('FinanceAll', 'Error loading shift items', itemsError);
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

        // Парсим результат из SQL функции
        const businessStatsData: BusinessFinanceStatsResult | undefined = businessStats ?? undefined;

        // Группируем смены по сотрудникам и считаем статистику
        // Используем данные из SQL функции для закрытых смен, добавляем расчеты для открытых
        const staffStats = (staffList || []).map((staff) => {
            // Находим статистику из SQL функции
            const sqlStats = businessStatsData?.staff_stats?.find(s => s.staff_id === staff.id);
            
            // Базовые значения из SQL функции (закрытые смены)
            let totalAmount = sqlStats?.stats.total_amount || 0;
            let totalMaster = sqlStats?.stats.total_master || 0;
            let totalSalon = sqlStats?.stats.total_salon || 0;
            let totalConsumables = sqlStats?.stats.total_consumables || 0;
            let totalLateMinutes = sqlStats?.stats.total_late_minutes || 0;
            let closedShiftsCount = sqlStats?.shifts.closed || 0;
            let openShiftsCount = sqlStats?.shifts.open || 0;
            
            // Находим открытые смены для этого сотрудника
            const staffOpenShifts = (openShifts || []).filter((s) => s.staff_id === staff.id);

            // Для открытых смен динамически рассчитываем из позиций
            for (const shift of staffOpenShifts) {
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
                shiftsCount: closedShiftsCount + staffOpenShifts.length,
                openShiftsCount: staffOpenShifts.length,
                closedShiftsCount,
                totalAmount,
                totalMaster,
                totalSalon,
                totalConsumables,
                totalLateMinutes,
            };
        });

        // Считаем общую статистику из staffStats
        // Это гарантирует, что открытые смены включены в статистику для всех периодов
        // Для периода "день" это особенно важно, чтобы видеть актуальные данные до закрытия смен
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

        return createSuccessResponse({
            period,
            dateFrom,
            dateTo,
            branchId: branchId || null,
            branches: (branches || []).map((b) => ({
                id: b.id,
                name: b.name,
            })),
            staffStats,
            totalStats,
        });
    });
}

// Fallback функция для обратной совместимости (старый метод)
// Пока не реализована, так как SQL функция должна работать
// Если понадобится, можно добавить полную реализацию старого метода
async function getFinanceStatsLegacy(
    _admin: ReturnType<typeof getServiceClient>,
    _bizId: string,
    _dateFrom: string,
    _dateTo: string,
    _branchId: string | null,
    _staffList: Array<{ id: string; full_name: string; is_active: boolean }>
) {
    return NextResponse.json({ ok: false, error: 'Legacy method not implemented. Please check SQL function.' }, { status: 500 });
}

