// apps/web/src/app/api/dashboard/staff/finance/all/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

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
    try {
        const { supabase, bizId } = await getBizContextForManagers();

        // Получаем параметры запроса
        const { searchParams } = new URL(req.url);
        const period = (searchParams.get('period') || 'day') as Period;
        const date = searchParams.get('date') || formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
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
            return NextResponse.json(
                { ok: false, error: branchesError.message },
                { status: 500 }
            );
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
            return NextResponse.json(
                { ok: false, error: staffError.message },
                { status: 500 }
            );
        }

        // Используем service client для обхода RLS, так как владелец должен видеть данные своих сотрудников
        const admin = getServiceClient();

        // Используем оптимизированную SQL функцию для получения статистики
        // Это уменьшает количество запросов к БД и выполняет агрегацию на стороне сервера
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
            });
            // Возвращаем ошибку с деталями вместо fallback
            return NextResponse.json(
                { 
                    ok: false, 
                    error: 'get_business_finance_stats_failed',
                    message: statsError.message || 'Failed to get finance stats',
                    details: statsError.details,
                },
                { status: 500 }
            );
        }

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

        // Считаем общую статистику
        // Используем данные из SQL функции, если доступны, иначе считаем из staffStats
        const totalStats = businessStatsData?.total_stats ? {
            totalAmount: businessStatsData.total_stats.total_amount,
            totalMaster: businessStatsData.total_stats.total_master,
            totalSalon: businessStatsData.total_stats.total_salon,
            totalConsumables: businessStatsData.total_stats.total_consumables,
            totalLateMinutes: businessStatsData.total_stats.total_late_minutes,
            totalShifts: businessStatsData.total_stats.total_shifts,
            totalOpenShifts: businessStatsData.total_stats.open_shifts,
            totalClosedShifts: businessStatsData.total_stats.closed_shifts,
        } : {
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
            branchId: branchId || null,
            branches: (branches || []).map((b) => ({
                id: b.id,
                name: b.name,
            })),
            staffStats,
            totalStats,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('FinanceAll', 'Unexpected error', e);
        return NextResponse.json(
            { ok: false, error: msg },
            { status: 500 }
        );
    }
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

