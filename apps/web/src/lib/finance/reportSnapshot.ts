import { isFinanceDate } from '@/lib/finance/calendar';
import type { StaffFinanceStatsShiftItem } from '@/lib/finance/types';

export type ReportClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
export type ReportStaff = {
    id: string; full_name: string | null; is_active: boolean; branch_id: string | null;
    hourly_rate: number | null; percent_master: number | null; percent_salon: number | null;
};
export type ReportShift = {
    id: string; staff_id: string; shift_date: string; status: 'open' | 'closed';
    ledger_revision: number; timezone: string; day_start: string; day_end: string; day_hours: number;
    opened_at: string | null; closed_at: string | null; hourly_rate?: number | null;
    percent_master?: number | null; percent_salon?: number | null;
    master_share?: number | null; salon_share?: number | null; late_minutes?: number | null;
    total_amount?: number | null; consumables_amount?: number | null; topup_amount?: number | null;
    hours_worked?: number | null; guaranteed_amount?: number | null;
    staff?: Pick<ReportStaff, 'hourly_rate' | 'percent_master' | 'percent_salon'>;
    items: StaffFinanceStatsShiftItem[];
};
export type FinanceReport = {
    branches: Array<{ id: string; name: string }>;
    staff: ReportStaff[];
    shifts: ReportShift[];
    closedStats: Array<{ staff_id: string; closed_shifts: number; total_amount: number; total_master: number;
        total_salon: number; total_consumables: number; total_late_minutes: number }>;
};

/** Service-only RPC: one tenant and at most 366 inclusive dates, no REST row-set cap. */
export async function readFinanceReport(client: ReportClient, scope: {
    bizId: string; dateFrom: string; dateTo: string; staffId?: string; branchId?: string | null;
}): Promise<FinanceReport> {
    const { data, error } = await client.rpc('read_finance_report_snapshot', {
        p_biz_id: scope.bizId, p_date_from: scope.dateFrom, p_date_to: scope.dateTo,
        p_staff_id: scope.staffId ?? null, p_branch_id: scope.branchId ?? null,
    });
    if (error) throw new Error(error.message);
    const report = data as FinanceReport | null;
    if (!report || !Array.isArray(report.branches) || !Array.isArray(report.staff) ||
        !Array.isArray(report.closedStats) || !Array.isArray(report.shifts) ||
        report.shifts.some(shift => !shift || typeof shift.id !== 'string' || !Array.isArray(shift.items) || !Number.isSafeInteger(shift.ledger_revision) ||
            typeof shift.timezone !== 'string' || !shift.timezone || !(shift.day_hours > 0 && shift.day_hours <= 25) ||
            !Number.isFinite(Date.parse(shift.day_start)) || !Number.isFinite(Date.parse(shift.day_end)) ||
            Date.parse(shift.day_end) - Date.parse(shift.day_start) !== shift.day_hours * 3600000)) {
        throw new Error('Неполный финансовый снимок. Повторите запрос.');
    }
    return report;
}

/** Default date belongs to the authorized business; explicit date labels never pass through Date. */
export async function readFinanceReportToday(client: ReportClient, bizId: string): Promise<string> {
    const { data, error } = await client.rpc('read_business_finance_calendar', { p_biz_id: bizId });
    if (error) throw new Error(error.message);
    const calendar = data as { todayDate?: unknown; timezone?: unknown } | null;
    if (!calendar || typeof calendar.todayDate !== 'string' || !isFinanceDate(calendar.todayDate) ||
        typeof calendar.timezone !== 'string' || !calendar.timezone) throw new Error('Неполный бизнес-календарь отчёта');
    return calendar.todayDate;
}
export function financeReportWorkedHours(shift: Pick<ReportShift, 'opened_at' | 'day_start' | 'day_end'>, now = Date.now()): number | null {
    const opened = shift.opened_at ? Date.parse(shift.opened_at) : NaN;
    const end = Math.min(now, Date.parse(shift.day_end));
    return Number.isFinite(opened) && opened >= Date.parse(shift.day_start) && opened <= end
        ? Math.round((end - opened) / 3600000 * 100) / 100 : null;
}
