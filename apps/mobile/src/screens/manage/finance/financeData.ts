import { apiRequest } from '../../../lib/api';
import { addDaysToDate } from '../opsKit/dates';

/*
 * The website's business finance (/dashboard/finance): GET /api/dashboard/finance/all for every
 * master of the business, GET /api/dashboard/finance/[id]/stats for one master. All amounts are
 * the server's sums of the shifts; nothing is recomputed here.
 */

export type FinancePeriod = 'day' | 'month' | 'year';
export const FINANCE_PERIODS: FinancePeriod[] = ['day', 'month', 'year'];

export type StaffStat = {
    staffId: string;
    staffName: string;
    isActive: boolean;
    shiftsCount: number;
    openShiftsCount: number;
    closedShiftsCount: number;
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
};

export type TotalStats = {
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
    totalShifts: number;
    totalOpenShifts: number;
    totalClosedShifts: number;
};

export type AllStaffFinance = {
    dateFrom: string;
    branches: { id: string; name: string }[];
    staffStats: StaffStat[];
    totalStats: TotalStats | null;
};

/** The date of the request at the period's precision: 2026-11-26, 2026-11 or 2026 (web financePeriodDate). */
export function financePeriodDate(period: FinancePeriod, date: string): string {
    return period === 'day' ? date.slice(0, 10) : period === 'month' ? date.slice(0, 7) : date.split('-')[0];
}

/** A day anchor for a period value (web financeDateAnchor). */
export function financeDateAnchor(period: FinancePeriod, value: string): string {
    if (!value) return '';
    return period === 'month' ? `${value}-01` : period === 'year' ? `${value}-01-01` : value;
}

/** The anchor of the previous (-1) or next (+1) day, month or year. */
export function shiftFinanceAnchor(period: FinancePeriod, anchor: string, step: number): string {
    if (period === 'day') return addDaysToDate(anchor.slice(0, 10), step);
    const [yearText, monthText = '01'] = anchor.split('-');
    const year = Number(yearText);
    if (period === 'year') return `${year + step}-01-01`;
    const index = year * 12 + (Number(monthText) - 1) + step;
    const nextYear = Math.floor(index / 12);
    const nextMonth = (index % 12) + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

/** The total turnover the website shows first: services plus consumables. */
export function totalWithConsumables(stats: Pick<TotalStats, 'totalAmount' | 'totalConsumables'>): number {
    return stats.totalAmount + stats.totalConsumables;
}

type Envelope<T> = { ok?: boolean; data?: T; message?: string; error?: string };

function financeQuery(period: FinancePeriod, anchor: string | null, extra: Record<string, string> = {}): string {
    const params = [`period=${period}`];
    if (anchor) params.push(`date=${financePeriodDate(period, anchor)}`);
    for (const [key, value] of Object.entries(extra)) params.push(`${key}=${encodeURIComponent(value)}`);
    return params.join('&');
}

/** Every master's sums of the period; without `anchor` the server takes today of the business. */
export async function fetchAllStaffFinance(period: FinancePeriod, anchor: string | null, branchId: string): Promise<AllStaffFinance> {
    const query = financeQuery(period, anchor, branchId !== 'all' ? { branchId } : {});
    const response = await apiRequest<Envelope<Partial<AllStaffFinance>>>(`/api/dashboard/finance/all?${query}`);
    if (!response?.ok || !response.data) throw new Error(response?.message || response?.error || 'Finance response without data');
    return {
        dateFrom: response.data.dateFrom ?? '',
        branches: Array.isArray(response.data.branches)
            ? response.data.branches.map((branch) => ({ id: String(branch.id), name: String(branch.name) }))
            : [],
        staffStats: response.data.staffStats ?? [],
        totalStats: response.data.totalStats ?? null,
    };
}

export type StaffFinanceShiftItem = {
    id: string;
    client_name: string;
    service_name: string;
    service_amount: number;
    consumables_amount: number;
    note: string | null;
    booking_id: string | null;
    created_at: string | null;
};

export type StaffFinanceShift = {
    id: string;
    shift_date: string;
    status: 'open' | 'closed';
    opened_at: string | null;
    closed_at: string | null;
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    base_master_share?: number;
    late_minutes: number;
    hours_worked: number | null;
    guaranteed_amount: number;
    topup_amount?: number;
    items: StaffFinanceShiftItem[];
};

export type StaffFinanceStats = {
    period: FinancePeriod;
    dateFrom: string;
    dateTo: string;
    staffName: string | null;
    shiftsCount: number;
    openShiftsCount: number;
    closedShiftsCount: number;
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
    totalClients: number;
    totalBaseMasterShare: number;
    totalBaseSalonShare: number;
    totalGuaranteedAmount: number;
    totalTopupAmount?: number;
    hasGuaranteedPayment: boolean;
    shifts: StaffFinanceShift[];
};

/** One master's sums and shifts of the period (the website's staff finance stats). */
export async function fetchStaffFinanceStats(staffId: string, period: FinancePeriod, anchor: string | null): Promise<StaffFinanceStats> {
    const response = await apiRequest<{ ok?: boolean; data?: { stats?: StaffFinanceStats }; stats?: StaffFinanceStats; error?: string }>(
        `/api/dashboard/finance/${encodeURIComponent(staffId)}/stats?${financeQuery(period, anchor)}`,
    );
    const stats = response?.data?.stats ?? response?.stats;
    if (!response?.ok || !stats) throw new Error(response?.error || 'Finance stats response without data');
    return stats;
}

/** The guarantee top-up of the period: the server total, else the sum of the shifts. */
export function guaranteeTopup(stats: Pick<StaffFinanceStats, 'totalTopupAmount' | 'shifts'>): number {
    return stats.totalTopupAmount ?? stats.shifts.reduce((sum, shift) =>
        sum + (shift.topup_amount ?? Math.max(0, shift.guaranteed_amount - (shift.base_master_share ?? shift.master_share))), 0);
}
