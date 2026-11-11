import { readAnalyticsSnapshot, reportFailure, type HourlyAnalyticsRow } from '@/lib/analyticsReportSnapshot';
import type { ReportClient } from '@/lib/finance/reportSnapshot';
import { getCached, setCached } from '@/lib/simpleCache';

export async function getDashboardAnalyticsLoad({
    admin,
    bizId,
    branchId,
    startDate,
    endDate,
}: {
    admin: ReportClient;
    bizId: string;
    branchId?: string;
    startDate: string;
    endDate: string;
}): Promise<
    | { ok: true; data: unknown }
    | { ok: false; error: 'server' | 'validation'; message: string; status: 500 | 400 }
> {
    const cacheKey = `dashboard_analytics_load:${bizId}:${branchId || 'all'}:${startDate}:${endDate}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
        return { ok: true, data: cached };
    }

    let data;
    try { data = (await readAnalyticsSnapshot(admin, { bizId, branchId, startDate, endDate, kind: 'hourly' })).rows as unknown as HourlyAnalyticsRow[]; }
    catch (error) { return reportFailure(error); }

    const payload = {
        bizId,
        branchId: branchId ?? null,
        period: { startDate, endDate },
        points: data.map((row) => ({
            date: row.date,
            hour: row.hour,
            bookingsCount: row.bookings_count ?? 0,
            promoBookingsCount: row.promo_bookings_count ?? 0,
            staffCount: row.staff_count ?? null,
            uniqueClientsCount: row.unique_clients_count ?? null,
        })),
    };

    setCached(cacheKey, payload, 60_000);

    return {
        ok: true,
        data: payload,
    };
}
