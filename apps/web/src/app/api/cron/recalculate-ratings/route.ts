// apps/web/src/app/api/cron/recalculate-ratings/route.ts
import { sendAlertEmail } from '@/lib/alerts';
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';
import { measurePerformance } from '@/lib/performance';
import { getServiceClient } from '@/lib/supabaseService';
import { addDaysToDateString, getTimezone, todayDateString } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Проверка секретного ключа для безопасности
const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(req: Request) {
    return withErrorHandler('RecalculateRatingsCron', async () => {
        // Проверяем секретный ключ для безопасности
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const supabase = getServiceClient();

        // Целевая дата метрик (по умолчанию — вчера в эталонной таймзоне) и окно для догоняющего пересчёта
        const tz = getTimezone();
        const todayStr = todayDateString(tz);
        const yesterdayStr = addDaysToDateString(todayStr, -1, tz);
        const maxLookbackDays = 7;

        // Определяем, с какой даты нужно начинать догоняющий пересчёт:
        // - если есть метрики в biz_day_metrics, берём день после последней даты;
        // - иначе ограничиваемся окном последних maxLookbackDays дней.
        const { data: lastBizMetric } = await supabase
            .from('biz_day_metrics')
            .select('metric_date')
            .order('metric_date', { ascending: false })
            .limit(1)
            .maybeSingle<{ metric_date: string }>();

        let rangeStartStr = addDaysToDateString(yesterdayStr, -(maxLookbackDays - 1), tz);
        if (lastBizMetric?.metric_date) {
            const lastDate = lastBizMetric.metric_date;
            // Если последняя дата метрик раньше вчера, начинаем с дня после неё,
            // но не заходим дальше, чем на maxLookbackDays назад.
            if (lastDate < yesterdayStr) {
                const candidate = addDaysToDateString(lastDate, 1, tz);
                rangeStartStr = candidate > rangeStartStr ? candidate : rangeStartStr;
            } else {
                // Метрики уже есть как минимум до вчера — пересчитываем только вчера
                rangeStartStr = yesterdayStr;
            }
        }

        // Гарантируем, что начало диапазона не позже конца
        if (rangeStartStr > yesterdayStr) {
            rangeStartStr = yesterdayStr;
        }

        logDebug('RecalculateRatingsCron', 'Starting ratings recalculation', {
            mode: 'interval',
            startDate: rangeStartStr,
            endDate: yesterdayStr,
        });

        const startedAt = Date.now();

        // Вызываем функцию пересчета рейтингов:
        // - если нужно пересчитать только один день — используем recalculate_ratings_for_date;
        // - если диапазон больше одного дня — используем recalculate_ratings_for_date_range.
        const { data, error } = await measurePerformance(
            'recalculate_ratings',
            async () => {
                if (rangeStartStr === yesterdayStr) {
                    // Совместимость со старой логикой: p_date = null => "вчера"
                    return await supabase.rpc('recalculate_ratings_for_date', {
                        p_date: null,
                    });
                }
                return await supabase.rpc('recalculate_ratings_for_date_range', {
                    p_start_date: rangeStartStr,
                    p_end_date: yesterdayStr,
                });
            },
            { startDate: rangeStartStr, endDate: yesterdayStr },
        );

        const durationMs = Date.now() - startedAt;

        if (error) {
            logError('RecalculateRatingsCron', 'RPC recalculate_ratings_for_date failed', error);
            // Алерт при сбое cron: оповещение по email для быстрой реакции
            const alertResult = await sendAlertEmail([
                {
                    type: 'error',
                    message: 'Cron пересчёта рейтингов упал',
                    details: { error: error.message, code: error.code },
                },
            ]);
            if (!alertResult.success) {
                logError('RecalculateRatingsCron', 'Failed to send alert email', alertResult.error);
            }
            return createErrorResponse('internal', error.message, undefined, 500);
        }

        // После успешного пересчёта собираем краткую статистику:
        // - по ошибкам пересчёта за целевой день;
        // - по количеству сущностей с рассчитанными метриками за этот день;
        // - по доле сущностей без рейтинга.
        let errorsSummary: { total: number; byType: Record<string, number> } | undefined;
        let metricsSummary:
            | {
                  staffDayMetrics: number;
                  branchDayMetrics: number;
                  bizDayMetrics: number;
              }
            | undefined;

        try {
            const { data: errorsData, error: errorsFetchError } = await supabase
                .from('rating_recalc_errors')
                .select('id, entity_type')
                .eq('metric_date', yesterdayStr);

            if (!errorsFetchError && errorsData) {
                const byType: Record<string, number> = {};
                for (const row of errorsData as { entity_type: string }[]) {
                    byType[row.entity_type] = (byType[row.entity_type] ?? 0) + 1;
                }
                errorsSummary = {
                    total: errorsData.length,
                    byType,
                };
            } else if (errorsFetchError) {
                logError('RecalculateRatingsCron', 'Failed to fetch rating_recalc_errors summary', errorsFetchError);
            }
        } catch (e) {
            logError('RecalculateRatingsCron', 'Unexpected error when fetching rating_recalc_errors summary', e);
        }

        let ratingNullSummary:
            | {
                  staffTotal: number;
                  staffNull: number;
                  branchesTotal: number;
                  branchesNull: number;
                  bizTotal: number;
                  bizNull: number;
              }
            | undefined;

        try {
            const [
                staffMetricsRes,
                branchMetricsRes,
                bizMetricsRes,
                staffRatingRes,
                branchesRatingRes,
                bizRatingRes,
            ] = await Promise.all([
                supabase
                    .from('staff_day_metrics')
                    .select('id', { count: 'exact', head: true })
                    .eq('metric_date', yesterdayStr),
                supabase
                    .from('branch_day_metrics')
                    .select('id', { count: 'exact', head: true })
                    .eq('metric_date', yesterdayStr),
                supabase
                    .from('biz_day_metrics')
                    .select('id', { count: 'exact', head: true })
                    .eq('metric_date', yesterdayStr),
                supabase.from('staff').select('id', { count: 'exact', head: true }),
                supabase.from('branches').select('id', { count: 'exact', head: true }),
                supabase.from('businesses').select('id', { count: 'exact', head: true }),
            ]);

            metricsSummary = {
                staffDayMetrics: staffMetricsRes.count ?? 0,
                branchDayMetrics: branchMetricsRes.count ?? 0,
                bizDayMetrics: bizMetricsRes.count ?? 0,
            };

            // Считаем долю сущностей без рейтинга по каждому уровню
            const [
                { count: staffWithoutRating },
                { count: branchesWithoutRating },
                { count: bizWithoutRating },
            ] = await Promise.all([
                supabase.from('staff').select('id', { count: 'exact', head: true }).is('rating_score', null),
                supabase.from('branches').select('id', { count: 'exact', head: true }).is('rating_score', null),
                supabase.from('businesses').select('id', { count: 'exact', head: true }).is('rating_score', null),
            ]);

            ratingNullSummary = {
                staffTotal: staffRatingRes.count ?? 0,
                staffNull: staffWithoutRating ?? 0,
                branchesTotal: branchesRatingRes.count ?? 0,
                branchesNull: branchesWithoutRating ?? 0,
                bizTotal: bizRatingRes.count ?? 0,
                bizNull: bizWithoutRating ?? 0,
            };
        } catch (e) {
            logError('RecalculateRatingsCron', 'Failed to fetch metrics counts summary', e);
        }

        logDebug('RecalculateRatingsCron', 'Successfully recalculated ratings', {
            data,
            rangeStart: rangeStartStr,
            rangeEnd: yesterdayStr,
            processedDays: Math.max(
                1,
                Math.floor(
                    (new Date(yesterdayStr).getTime() - new Date(rangeStartStr).getTime()) /
                        (1000 * 60 * 60 * 24),
                ) + 1,
            ),
            durationMs,
            metricsSummary,
            errorsSummary,
            ratingNullSummary,
        });

        const responsePayload = {
            message: 'Ratings recalculated successfully',
            rangeStart: rangeStartStr,
            rangeEnd: yesterdayStr,
            processedDays: Math.max(
                1,
                Math.floor(
                    (new Date(yesterdayStr).getTime() - new Date(rangeStartStr).getTime()) /
                        (1000 * 60 * 60 * 24),
                ) + 1,
            ),
            durationMs,
            metricsSummary,
            errorsSummary,
            ratingNullSummary,
        } as const;

        // При критических отклонениях — более жёсткий alert
        const hasErrors = (errorsSummary?.total ?? 0) > 0;
        const staffNullShare =
            ratingNullSummary && ratingNullSummary.staffTotal > 0
                ? ratingNullSummary.staffNull / ratingNullSummary.staffTotal
                : 0;
        const branchesNullShare =
            ratingNullSummary && ratingNullSummary.branchesTotal > 0
                ? ratingNullSummary.branchesNull / ratingNullSummary.branchesTotal
                : 0;
        const bizNullShare =
            ratingNullSummary && ratingNullSummary.bizTotal > 0
                ? ratingNullSummary.bizNull / ratingNullSummary.bizTotal
                : 0;

        const criticalShareThreshold = 0.1; // 10%
        const hasCriticalNullShare =
            staffNullShare > criticalShareThreshold ||
            branchesNullShare > criticalShareThreshold ||
            bizNullShare > criticalShareThreshold;

        if (hasErrors || hasCriticalNullShare) {
            const alertType = hasErrors ? 'error' : 'warning';
            const alertMessage =
                alertType === 'error'
                    ? 'Критические ошибки пересчёта рейтингов'
                    : 'Высокая доля сущностей без рейтинга после пересчёта рейтингов';

            const alertDetails = {
                rangeStart: rangeStartStr,
                rangeEnd: yesterdayStr,
                processedDays: responsePayload.processedDays,
                errorsSummary,
                ratingNullSummary,
                shares: {
                    staffNullShare,
                    branchesNullShare,
                    bizNullShare,
                },
            };

            const alertResult = await sendAlertEmail([
                {
                    type: alertType as 'error' | 'warning',
                    message: alertMessage,
                    details: alertDetails,
                },
            ]);

            if (!alertResult.success) {
                logError('RecalculateRatingsCron', 'Failed to send critical rating alert email', alertResult.error);
            }
        }

        return createSuccessResponse(responsePayload);
    });
}

