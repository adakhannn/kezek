import { logDebug, logError } from '@/lib/log';
import { addDaysToDateString } from '@/lib/time';

type AlertPayload = {
    type: 'error' | 'warning';
    message: string;
    details?: Record<string, unknown>;
};

export type RecalculateRatingsSupabaseLike = {
    from: (table: string) => any;
    rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

type MeasurePerformance = <T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
) => Promise<T>;

type RecalculateRatingsCronDeps = {
    supabase: RecalculateRatingsSupabaseLike;
    measurePerformance: MeasurePerformance;
    sendAlertEmail: (alerts: AlertPayload[]) => Promise<{ success: boolean; error?: string }>;
    tz: string;
    todayStr: string;
    nowMs?: () => number;
};

type ErrorsSummary = {
    total: number;
    byType: Record<string, number>;
};

type MetricsSummary = {
    staffDayMetrics: number;
    branchDayMetrics: number;
    bizDayMetrics: number;
};

type RatingNullSummary = {
    staffTotal: number;
    staffNull: number;
    branchesTotal: number;
    branchesNull: number;
    bizTotal: number;
    bizNull: number;
};

function countDays(rangeStart: string, rangeEnd: string) {
    return Math.max(
        1,
        Math.floor((new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
}

function computeRangeStart({
    yesterdayStr,
    lastMetricDate,
    tz,
}: {
    yesterdayStr: string;
    lastMetricDate?: string;
    tz: string;
}) {
    const maxLookbackDays = 7;
    let rangeStartStr = addDaysToDateString(yesterdayStr, -(maxLookbackDays - 1), tz);

    if (lastMetricDate) {
        if (lastMetricDate < yesterdayStr) {
            const candidate = addDaysToDateString(lastMetricDate, 1, tz);
            rangeStartStr = candidate > rangeStartStr ? candidate : rangeStartStr;
        } else {
            rangeStartStr = yesterdayStr;
        }
    }

    if (rangeStartStr > yesterdayStr) {
        rangeStartStr = yesterdayStr;
    }

    return rangeStartStr;
}

async function loadErrorsSummary(supabase: RecalculateRatingsSupabaseLike, metricDate: string): Promise<ErrorsSummary | undefined> {
    try {
        const { data, error } = await supabase
            .from('rating_recalc_errors')
            .select('id, entity_type')
            .eq('metric_date', metricDate);

        if (error || !data) {
            if (error) {
                logError('RecalculateRatingsCron', 'Failed to fetch rating_recalc_errors summary', error);
            }
            return undefined;
        }

        const byType: Record<string, number> = {};
        for (const row of data as { entity_type: string }[]) {
            byType[row.entity_type] = (byType[row.entity_type] ?? 0) + 1;
        }

        return {
            total: data.length,
            byType,
        };
    } catch (error) {
        logError('RecalculateRatingsCron', 'Unexpected error when fetching rating_recalc_errors summary', error);
        return undefined;
    }
}

async function loadMetricsAndRatingSummary(supabase: RecalculateRatingsSupabaseLike, metricDate: string) {
    try {
        const [
            staffMetricsRes,
            branchMetricsRes,
            bizMetricsRes,
            staffRatingRes,
            branchesRatingRes,
            bizRatingRes,
        ] = await Promise.all([
            supabase.from('staff_day_metrics').select('id', { count: 'exact', head: true }).eq('metric_date', metricDate),
            supabase.from('branch_day_metrics').select('id', { count: 'exact', head: true }).eq('metric_date', metricDate),
            supabase.from('biz_day_metrics').select('id', { count: 'exact', head: true }).eq('metric_date', metricDate),
            supabase.from('staff').select('id', { count: 'exact', head: true }),
            supabase.from('branches').select('id', { count: 'exact', head: true }),
            supabase.from('businesses').select('id', { count: 'exact', head: true }),
        ]);

        const [
            { count: staffWithoutRating },
            { count: branchesWithoutRating },
            { count: bizWithoutRating },
        ] = await Promise.all([
            supabase.from('staff').select('id', { count: 'exact', head: true }).is('rating_score', null),
            supabase.from('branches').select('id', { count: 'exact', head: true }).is('rating_score', null),
            supabase.from('businesses').select('id', { count: 'exact', head: true }).is('rating_score', null),
        ]);

        const metricsSummary: MetricsSummary = {
            staffDayMetrics: staffMetricsRes.count ?? 0,
            branchDayMetrics: branchMetricsRes.count ?? 0,
            bizDayMetrics: bizMetricsRes.count ?? 0,
        };

        const ratingNullSummary: RatingNullSummary = {
            staffTotal: staffRatingRes.count ?? 0,
            staffNull: staffWithoutRating ?? 0,
            branchesTotal: branchesRatingRes.count ?? 0,
            branchesNull: branchesWithoutRating ?? 0,
            bizTotal: bizRatingRes.count ?? 0,
            bizNull: bizWithoutRating ?? 0,
        };

        return { metricsSummary, ratingNullSummary };
    } catch (error) {
        logError('RecalculateRatingsCron', 'Failed to fetch metrics counts summary', error);
        return {
            metricsSummary: undefined,
            ratingNullSummary: undefined,
        };
    }
}

export async function runRecalculateRatingsCron({
    supabase,
    measurePerformance,
    sendAlertEmail,
    tz,
    todayStr,
    nowMs = () => Date.now(),
}: RecalculateRatingsCronDeps) {
    const yesterdayStr = addDaysToDateString(todayStr, -1, tz);

    const lastMetricResponse = (supabase
        .from('biz_day_metrics')
        .select('metric_date')
        .order('metric_date', { ascending: false })
        .limit(1)
        .maybeSingle() as Promise<{ data: { metric_date: string } | null }>);
    const { data: lastBizMetric } = await lastMetricResponse;

    const rangeStartStr = computeRangeStart({
        yesterdayStr,
        lastMetricDate: lastBizMetric?.metric_date,
        tz,
    });

    logDebug('RecalculateRatingsCron', 'Starting ratings recalculation', {
        mode: 'interval',
        startDate: rangeStartStr,
        endDate: yesterdayStr,
    });

    const startedAt = nowMs();
    const { data, error } = await measurePerformance(
        'recalculate_ratings',
        async () => {
            if (rangeStartStr === yesterdayStr) {
                return supabase.rpc('recalculate_ratings_for_date', { p_date: null });
            }

            return supabase.rpc('recalculate_ratings_for_date_range', {
                p_start_date: rangeStartStr,
                p_end_date: yesterdayStr,
            });
        },
        { startDate: rangeStartStr, endDate: yesterdayStr }
    );
    const durationMs = nowMs() - startedAt;

    if (error) {
        logError('RecalculateRatingsCron', 'RPC recalculate_ratings_for_date failed', error);
        const alertResult = await sendAlertEmail([
            {
                type: 'error',
                message: 'Cron пересчета рейтингов упал',
                details: { error: error.message, code: error.code },
            },
        ]);

        if (!alertResult.success) {
            logError('RecalculateRatingsCron', 'Failed to send alert email', alertResult.error);
        }

        return {
            ok: false as const,
            error: error.message || 'Ratings recalculation failed',
            status: 500,
        };
    }

    const errorsSummary = await loadErrorsSummary(supabase, yesterdayStr);
    const { metricsSummary, ratingNullSummary } = await loadMetricsAndRatingSummary(supabase, yesterdayStr);
    const processedDays = countDays(rangeStartStr, yesterdayStr);

    const staffNullShare = ratingNullSummary && ratingNullSummary.staffTotal > 0 ? ratingNullSummary.staffNull / ratingNullSummary.staffTotal : 0;
    const branchesNullShare =
        ratingNullSummary && ratingNullSummary.branchesTotal > 0 ? ratingNullSummary.branchesNull / ratingNullSummary.branchesTotal : 0;
    const bizNullShare = ratingNullSummary && ratingNullSummary.bizTotal > 0 ? ratingNullSummary.bizNull / ratingNullSummary.bizTotal : 0;

    const hasErrors = (errorsSummary?.total ?? 0) > 0;
    const hasCriticalNullShare = staffNullShare > 0.1 || branchesNullShare > 0.1 || bizNullShare > 0.1;

    if (hasErrors || hasCriticalNullShare) {
        const alertResult = await sendAlertEmail([
            {
                type: hasErrors ? 'error' : 'warning',
                message: hasErrors
                    ? 'Критические ошибки пересчета рейтингов'
                    : 'Высокая доля сущностей без рейтинга после пересчета рейтингов',
                details: {
                    rangeStart: rangeStartStr,
                    rangeEnd: yesterdayStr,
                    processedDays,
                    errorsSummary,
                    ratingNullSummary,
                    shares: {
                        staffNullShare,
                        branchesNullShare,
                        bizNullShare,
                    },
                },
            },
        ]);

        if (!alertResult.success) {
            logError('RecalculateRatingsCron', 'Failed to send critical rating alert email', alertResult.error);
        }
    }

    logDebug('RecalculateRatingsCron', 'Successfully recalculated ratings', {
        data,
        rangeStart: rangeStartStr,
        rangeEnd: yesterdayStr,
        processedDays,
        durationMs,
        metricsSummary,
        errorsSummary,
        ratingNullSummary,
    });

    return {
        ok: true as const,
        data: {
            message: 'Ratings recalculated successfully',
            rangeStart: rangeStartStr,
            rangeEnd: yesterdayStr,
            processedDays,
            durationMs,
            metricsSummary,
            errorsSummary,
            ratingNullSummary,
        },
    };
}
