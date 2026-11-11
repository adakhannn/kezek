import { recalculateAnalyticsDay, type AnalyticsReportClient } from '@/lib/analyticsReportCommand';
import { analyticsReportDates } from '@/lib/analyticsReportDates';
import { logDebug } from '@/lib/log';
import { todayDateString } from '@/lib/time';

type RunAnalyticsDailyCronInput = { supabase: AnalyticsReportClient; tz: string; startDate?: string | null; endDate?: string | null; today?: string };

export async function runAnalyticsDailyCron({
    supabase,
    tz,
    startDate,
    endDate,
    today = todayDateString(tz),
}: RunAnalyticsDailyCronInput) {
    const days = analyticsReportDates(today, tz, startDate, endDate);

    const results: Array<{ date: string; updated: number }> = [];
    for (const day of days) {
        results.push(await recalculateAnalyticsDay(supabase, 'daily', day, tz));
    }

    logDebug('AnalyticsDailyCron', 'Completed daily analytics aggregation', {
        days: results.length,
        range: days,
    });

    return {
        ok: true as const,
        data: {
            message: 'Analytics daily aggregation completed',
            results,
        },
    };
}
