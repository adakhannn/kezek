import { logDebug, logError } from '@/lib/log';
import { TZ, todayStringInTz } from '@/lib/time';
import { validateQuery } from '@/lib/validation/apiValidation';
import { financeAllQuerySchema } from '@/lib/validation/schemas';

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

type FinanceAllResult =
    | {
          ok: false;
          statusCode: 400 | 500;
          errorType: 'validation' | 'internal';
          message: string;
          details?: Record<string, unknown>;
      }
    | {
          ok: true;
          data: Record<string, unknown>;
      };

export async function runFinanceAllDashboard({
    req,
    supabase,
    admin,
    bizId,
}: {
    req: Request;
    supabase: any;
    admin: any;
    bizId: string;
}): Promise<FinanceAllResult> {
    const url = new URL(req.url);
    const queryValidation = validateQuery(url, financeAllQuerySchema);
    if (!queryValidation.success) {
        const validationJson = (await queryValidation.response.json()) as {
            message?: string;
            errors?: unknown;
        };
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: validationJson.message || 'Validation failed',
            details: validationJson as Record<string, unknown>,
        };
    }

    const { period, date: dateParam, branchId } = queryValidation.data;
    const periodTyped = (period || 'day') as Period;
    const date = dateParam || todayStringInTz(TZ);
    const { dateFrom, dateTo } = resolveDateRange(periodTyped, date);

    const { data: branches, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .eq('biz_id', bizId)
        .order('name');

    if (branchesError) {
        logError('FinanceAll', 'Error loading branches', branchesError);
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: branchesError.message,
        };
    }

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
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: staffError.message,
        };
    }

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
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: statsError.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ С„РёРЅР°РЅСЃРѕРІСѓСЋ СЃС‚Р°С‚РёСЃС‚РёРєСѓ',
            details: { details: statsError.details, hint: statsError.hint, code: statsError.code },
        };
    }

    logDebug('FinanceAll', 'get_business_finance_stats success', {
        hasData: !!businessStats,
        staffStatsCount: businessStats?.staff_stats?.length || 0,
    });

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

    const openShiftIds = (openShifts || []).map((shift: { id: string }) => shift.id);
    const shiftItemsMap: Record<
        string,
        Array<{
            id: string;
            client_name: string | null;
            service_name: string | null;
            service_amount: number;
            consumables_amount: number;
        }>
    > = {};

    if (openShiftIds.length > 0) {
        const { data: itemsData, error: itemsError } = await admin
            .from('staff_shift_items')
            .select('id, shift_id, client_name, service_name, service_amount, consumables_amount')
            .in('shift_id', openShiftIds)
            .order('created_at', { ascending: true });

        if (itemsError) {
            logError('FinanceAll', 'Error loading shift items', itemsError);
        } else {
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

    const businessStatsData: BusinessFinanceStatsResult | undefined = businessStats ?? undefined;
    const staffStats: Array<{
        staffId: string;
        staffName: string | null;
        isActive: boolean;
        shiftsCount: number;
        openShiftsCount: number;
        closedShiftsCount: number;
        totalAmount: number;
        totalMaster: number;
        totalSalon: number;
        totalConsumables: number;
        totalLateMinutes: number;
    }> = (staffList || []).map((staff: any) => {
        const sqlStats = businessStatsData?.staff_stats?.find((entry) => entry.staff_id === staff.id);
        let totalAmount = sqlStats?.stats.total_amount || 0;
        let totalMaster = sqlStats?.stats.total_master || 0;
        let totalSalon = sqlStats?.stats.total_salon || 0;
        let totalConsumables = sqlStats?.stats.total_consumables || 0;
        let totalLateMinutes = sqlStats?.stats.total_late_minutes || 0;
        const closedShiftsCount = sqlStats?.shifts.closed || 0;

        const staffOpenShifts = (openShifts || []).filter((shift: any) => shift.staff_id === staff.id);
        for (const shift of staffOpenShifts) {
            const shiftItems = shiftItemsMap[shift.id] || [];
            const shiftTotalAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
            const shiftConsumables = shiftItems.reduce((sum, item) => sum + item.consumables_amount, 0);
            const shiftPercentMaster = Number(shift.percent_master ?? staff.percent_master ?? 60);
            const shiftPercentSalon = Number(shift.percent_salon ?? staff.percent_salon ?? 40);
            const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
            const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
            const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
            const baseSalonShare = shiftTotalAmount - baseMasterShare;

            const hourlyRate = shift.hourly_rate
                ? Number(shift.hourly_rate)
                : staff.hourly_rate
                  ? Number(staff.hourly_rate)
                  : null;
            let guaranteedAmount = 0;

            if (hourlyRate && shift.opened_at) {
                const openedAt = new Date(shift.opened_at);
                const diffMs = new Date().getTime() - openedAt.getTime();
                const hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
                guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;
            }

            const finalMasterShare = guaranteedAmount > baseMasterShare ? guaranteedAmount : baseMasterShare;
            const topupAmount = guaranteedAmount > baseMasterShare ? guaranteedAmount - baseMasterShare : 0;
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

    const totalStats = {
        totalAmount: staffStats.reduce((sum: number, entry) => sum + entry.totalAmount, 0),
        totalMaster: staffStats.reduce((sum: number, entry) => sum + entry.totalMaster, 0),
        totalSalon: staffStats.reduce((sum: number, entry) => sum + entry.totalSalon, 0),
        totalConsumables: staffStats.reduce((sum: number, entry) => sum + entry.totalConsumables, 0),
        totalLateMinutes: staffStats.reduce((sum: number, entry) => sum + entry.totalLateMinutes, 0),
        totalShifts: staffStats.reduce((sum: number, entry) => sum + entry.shiftsCount, 0),
        totalOpenShifts: staffStats.reduce((sum: number, entry) => sum + entry.openShiftsCount, 0),
        totalClosedShifts: staffStats.reduce((sum: number, entry) => sum + entry.closedShiftsCount, 0),
    };

    return {
        ok: true,
        data: {
            period,
            dateFrom,
            dateTo,
            branchId: branchId || null,
            branches: (branches || []).map((branch: any) => ({
                id: branch.id,
                name: branch.name,
            })),
            staffStats,
            totalStats,
        },
    };
}

function resolveDateRange(period: Period, date: string) {
    if (period === 'day') {
        return { dateFrom: date, dateTo: date };
    }

    if (period === 'month') {
        const [year, month] = date.split('-');
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        return {
            dateFrom: `${year}-${month}-01`,
            dateTo: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
        };
    }

    const year = date.split('-')[0];
    return {
        dateFrom: `${year}-01-01`,
        dateTo: `${year}-12-31`,
    };
}
