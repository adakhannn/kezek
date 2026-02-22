// apps/web/src/app/api/cron/data-retention/route.ts
// Выполняет политику DATA_RETENTION: удаление/анонимизация старых данных.
// См. DATA_RETENTION.md и MONITORING_AND_ANALYTICS.md

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

const RETENTION = {
    apiMetricsDays: 90,
    financeLogsDays: 365,
    funnelEventsDays: 400,
    bookingsPiiOlderThanDays: 2555, // 7 years
    profilesInactiveDays: 1095,     // 3 years
} as const;

export async function GET(req: Request) {
    return withErrorHandler('DataRetentionCron', async () => {
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const supabase = getServiceClient();
        const result: Record<string, number | string> = {};

        try {
            // 1. API-метрики: удалить успешные запросы старше 90 дней (ошибки сохраняются)
            const { data: apiDeleted, error: e1 } = await supabase.rpc('cleanup_old_api_metrics', {
                p_keep_days: RETENTION.apiMetricsDays,
            });
            if (e1) {
                logError('DataRetentionCron', 'cleanup_old_api_metrics failed', e1);
                result.api_metrics_error = e1.message;
            } else {
                result.api_metrics_deleted = typeof apiDeleted === 'number' ? apiDeleted : 0;
            }

            // 2. Логи финансовых операций: удалить старше 365 дней (уровень error сохраняется)
            const { data: financeDeleted, error: e2 } = await supabase.rpc('cleanup_old_finance_logs', {
                p_keep_days: RETENTION.financeLogsDays,
            });
            if (e2) {
                logError('DataRetentionCron', 'cleanup_old_finance_logs failed', e2);
                result.finance_logs_error = e2.message;
            } else {
                result.finance_logs_deleted = typeof financeDeleted === 'number' ? financeDeleted : 0;
            }

            // 3. События воронки: удалить старше 400 дней
            const { data: funnelDeleted, error: e3 } = await supabase.rpc('cleanup_old_funnel_events', {
                p_keep_days: RETENTION.funnelEventsDays,
            });
            if (e3) {
                logError('DataRetentionCron', 'cleanup_old_funnel_events failed', e3);
                result.funnel_events_error = e3.message;
            } else {
                result.funnel_events_deleted = typeof funnelDeleted === 'number' ? funnelDeleted : 0;
            }

            // 4. Брони: анонимизировать PII старше 7 лет
            const { data: bookingsAnonymized, error: e4 } = await supabase.rpc('anonymize_old_bookings_pii', {
                p_older_than_days: RETENTION.bookingsPiiOlderThanDays,
            });
            if (e4) {
                logError('DataRetentionCron', 'anonymize_old_bookings_pii failed', e4);
                result.bookings_pii_error = e4.message;
            } else {
                result.bookings_pii_anonymized = typeof bookingsAnonymized === 'number' ? bookingsAnonymized : 0;
            }

            // 5. Профили: анонимизировать PII неактивных (3 года без броней)
            const { data: profilesAnonymized, error: e5 } = await supabase.rpc('anonymize_inactive_profiles_pii', {
                p_inactive_days: RETENTION.profilesInactiveDays,
            });
            if (e5) {
                logError('DataRetentionCron', 'anonymize_inactive_profiles_pii failed', e5);
                result.profiles_pii_error = e5.message;
            } else {
                result.profiles_pii_anonymized = typeof profilesAnonymized === 'number' ? profilesAnonymized : 0;
            }
        } catch (e) {
            logError('DataRetentionCron', 'Unexpected error', e);
            return createErrorResponse(
                'internal',
                e instanceof Error ? e.message : 'Data retention cron failed',
                undefined,
                500
            );
        }

        logDebug('DataRetentionCron', 'Completed', result);
        return createSuccessResponse({
            message: 'Data retention run completed',
            ...result,
        });
    });
}
