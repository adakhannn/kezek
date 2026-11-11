import type { ReportClient } from '@/lib/finance/reportSnapshot';

export type AnalyticsReportClient = ReportClient;

/** Aggregate and replace in one transaction. Missing/malformed results are never an empty-success fallback. */
export async function recalculateAnalyticsDay(client: AnalyticsReportClient, kind: 'daily' | 'hourly', date: string, fallbackTimezone: string) {
    const { data, error } = await client.rpc(kind === 'daily' ? 'recalculate_business_daily_stats' : 'recalculate_business_hourly_load', {
        p_date: date, p_default_tz: fallbackTimezone,
    });
    if (error) throw new Error(error.message);
    const result = data as { date?: string; updated?: number } | null;
    if (result?.date !== date || !Number.isSafeInteger(result.updated) || result.updated! < 0) {
        throw new Error('Analytics replacement did not return a confirmed result');
    }
    return { date, updated: result.updated! };
}
