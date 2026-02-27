// apps/web/src/app/api/cron/recalculate-ratings/route.ts
import { sendAlertEmail } from '@/lib/alerts';
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';
import { measurePerformance } from '@/lib/performance';
import { getServiceClient } from '@/lib/supabaseService';

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

        // Оцениваем целевую дату метрик (по умолчанию — вчера, в UTC) для дополнительной диагностики
        const metricDate = new Date();
        metricDate.setUTCDate(metricDate.getUTCDate() - 1);
        const metricDateStr = metricDate.toISOString().slice(0, 10);

        logDebug('RecalculateRatingsCron', 'Starting ratings recalculation', {
            metricDate: metricDateStr,
            mode: 'daily',
        });

        const startedAt = Date.now();

        // Вызываем функцию пересчета рейтингов за вчерашний день
        // Функция сама пересчитает метрики за вчера и обновит агрегированные рейтинги
        // Мониторинг производительности пересчета рейтингов
        const { data, error } = await measurePerformance(
            'recalculate_ratings',
            async () => {
                return await supabase.rpc('recalculate_ratings_for_date', {
                    p_date: null, // null означает вчерашний день (по умолчанию)
                });
            },
            { date: metricDateStr }
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
        // - по количеству сущностей с рассчитанными метриками за этот день.
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
                .eq('metric_date', metricDateStr);

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

        try {
            const [staffMetricsRes, branchMetricsRes, bizMetricsRes] = await Promise.all([
                supabase
                    .from('staff_day_metrics')
                    .select('id', { count: 'exact', head: true })
                    .eq('metric_date', metricDateStr),
                supabase
                    .from('branch_day_metrics')
                    .select('id', { count: 'exact', head: true })
                    .eq('metric_date', metricDateStr),
                supabase
                    .from('biz_day_metrics')
                    .select('id', { count: 'exact', head: true })
                    .eq('metric_date', metricDateStr),
            ]);

            metricsSummary = {
                staffDayMetrics: staffMetricsRes.count ?? 0,
                branchDayMetrics: branchMetricsRes.count ?? 0,
                bizDayMetrics: bizMetricsRes.count ?? 0,
            };
        } catch (e) {
            logError('RecalculateRatingsCron', 'Failed to fetch metrics counts summary', e);
        }

        logDebug('RecalculateRatingsCron', 'Successfully recalculated ratings', {
            data,
            metricDate: metricDateStr,
            durationMs,
            metricsSummary,
            errorsSummary,
        });

        return createSuccessResponse({
            message: 'Ratings recalculated successfully',
            metricDate: metricDateStr,
            durationMs,
            metricsSummary,
            errorsSummary,
        });
    });
}

