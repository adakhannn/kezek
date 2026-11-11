import type { ReportClient } from '@/lib/finance/reportSnapshot';

export class ReportRangeError extends Error {}
export function assertReportRange(start: string, end: string) {
    const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
    if (!valid(start) || !valid(end) || start > end || (Date.parse(end) - Date.parse(start)) / 86_400_000 > 365) {
        throw new ReportRangeError('Use a valid inclusive date range of at most 366 days');
    }
}
export function reportFailure(error: unknown) {
    return error instanceof ReportRangeError
        ? { ok: false as const, error: 'validation' as const, status: 400 as const, message: error.message }
        : { ok: false as const, error: 'server' as const, status: 500 as const, message: 'Failed to load complete analytics' };
}
export type DailyAnalyticsRow = { date: string; active_businesses?: number; home_views: number; business_page_views: number; booking_flow_starts: number;
    bookings_created: number; bookings_confirmed_or_paid: number; promo_bookings: number; promo_revenue: number; total_revenue: number };
export type HourlyAnalyticsRow = { date: string; branch_id: string; hour: number; bookings_count: number; promo_bookings_count: number;
    staff_count: number | null; unique_clients_count: number | null };
export type AnalyticsSnapshot = { rows: DailyAnalyticsRow[]; activeBusinesses?: number };
export async function readAnalyticsSnapshot(client: ReportClient, scope: {
    startDate: string; endDate: string; bizId?: string; branchId?: string; kind: 'daily' | 'hourly' | 'global';
}): Promise<AnalyticsSnapshot> {
    assertReportRange(scope.startDate, scope.endDate);
    const { data, error } = await client.rpc('read_analytics_report_snapshot', {
        p_date_from: scope.startDate, p_date_to: scope.endDate, p_biz_id: scope.bizId ?? null,
        p_branch_id: scope.branchId ?? null, p_kind: scope.kind,
    });
    if (error) throw new Error(error.message);
    const result = data as AnalyticsSnapshot | null;
    if (!result || !Array.isArray(result.rows) || (scope.kind === 'global' && !Number.isSafeInteger(result.activeBusinesses))) throw new Error('Incomplete analytics snapshot');
    const fields = scope.kind === 'hourly' ? ['hour', 'bookings_count', 'promo_bookings_count', 'staff_count', 'unique_clients_count']
        : ['home_views', 'business_page_views', 'booking_flow_starts', 'bookings_created', 'bookings_confirmed_or_paid', 'promo_bookings', 'promo_revenue', 'total_revenue'];
    for (const row of result.rows) {
        if (!row || typeof row.date !== 'string' || row.date < scope.startDate || row.date > scope.endDate) throw new Error('Invalid analytics date');
        for (const key of fields) {
            const value = (row as unknown as Record<string, unknown>)[key];
            if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Invalid analytics amount');
        }
    }
    return result;
}
export type PromotionSnapshot = { summary: { promoBookings: number; promoRevenue: number; totalRevenue: number };
    byDay: Array<{ date: string; promoBookings: number; promoRevenue: number; totalRevenue: number }>;
    byType: Array<{ promotionType: string; bookings: number; revenue: number; discountGiven: number }> };
export async function readPromotionSnapshot(client: ReportClient, scope: { bizId: string; branchId?: string; startDate: string; endDate: string; timezone: string }): Promise<PromotionSnapshot> {
    assertReportRange(scope.startDate, scope.endDate);
    const { data, error } = await client.rpc('read_promotion_analytics_snapshot', { p_biz_id: scope.bizId, p_branch_id: scope.branchId ?? null,
        p_date_from: scope.startDate, p_date_to: scope.endDate, p_default_tz: scope.timezone });
    if (error) throw new Error(error.message);
    const result = data as PromotionSnapshot | null;
    if (!result || !result.summary || !Array.isArray(result.byDay) || !Array.isArray(result.byType) ||
        ![result.summary.promoBookings, result.summary.promoRevenue, result.summary.totalRevenue].every(Number.isFinite)) throw new Error('Incomplete promotion snapshot');
    return result;
}
