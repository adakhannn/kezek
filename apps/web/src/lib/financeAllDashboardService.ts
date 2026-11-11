import { readFinanceReport, readFinanceReportToday, financeReportWorkedHours, type FinanceReport, type ReportClient } from '@/lib/finance/reportSnapshot';
import { logError } from '@/lib/log';
import { validateQuery } from '@/lib/validation/apiValidation';
import { financeAllQuerySchema } from '@/lib/validation/schemas';

type Period = 'day' | 'month' | 'year';

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
    admin,
    bizId,
}: {
    req: Request;
    supabase: unknown;
    admin: ReportClient;
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
    let date: string;
    try { date = dateParam || await readFinanceReportToday(admin, bizId); }
    catch { return { ok: false, statusCode: 500, errorType: 'internal', message: 'Не удалось получить бизнес-календарь отчёта' }; }
    const { dateFrom, dateTo } = resolveDateRange(periodTyped, date);

    let report: FinanceReport;
    try { report = await readFinanceReport(admin, { bizId, dateFrom, dateTo, branchId }); }
    catch (error) {
        logError('FinanceAll', 'Failed to read complete finance snapshot', error);
        return { ok: false, statusCode: 500, errorType: 'internal', message: error instanceof Error ? error.message : 'Не удалось получить финансовую статистику' };
    }
    const { branches, staff: staffList, shifts: openShifts } = report;
    const closedByStaff = new Map(report.closedStats.map(row => [row.staff_id, row]));
    const shiftsByStaff = new Map<string, typeof openShifts>();
    for (const shift of openShifts) {
        const rows = shiftsByStaff.get(shift.staff_id) ?? [];
        rows.push(shift); shiftsByStaff.set(shift.staff_id, rows);
    }

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
    }> = staffList.map((staff) => {
        const sqlStats = closedByStaff.get(staff.id);
        let totalAmount = sqlStats?.total_amount || 0;
        let totalMaster = sqlStats?.total_master || 0;
        let totalSalon = sqlStats?.total_salon || 0;
        let totalConsumables = sqlStats?.total_consumables || 0;
        let totalLateMinutes = sqlStats?.total_late_minutes || 0;
        const closedShiftsCount = sqlStats?.closed_shifts || 0;

        const staffOpenShifts = shiftsByStaff.get(staff.id) ?? [];
        for (const shift of staffOpenShifts) {
            const shiftItems = shift.items;
            const shiftTotalAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
            const shiftConsumables = shiftItems.reduce((sum, item) => sum + item.consumables_amount, 0);
            const shiftPercentMaster = Number(shift.percent_master ?? staff.percent_master ?? 60);
            const shiftPercentSalon = Number(shift.percent_salon ?? staff.percent_salon ?? 40);
            const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
            const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
            const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
            const baseSalonShare = shiftTotalAmount - baseMasterShare + shiftConsumables;

            const hourlyRate = shift.hourly_rate != null
                ? Number(shift.hourly_rate)
                : staff.hourly_rate != null
                  ? Number(staff.hourly_rate)
                  : null;
            let guaranteedAmount = 0;

            const hoursWorked = financeReportWorkedHours(shift);
            if (hourlyRate && hoursWorked !== null) {
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
            branches: branches.map((branch) => ({
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

