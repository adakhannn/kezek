import { NextResponse } from 'next/server';

import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { formatInTimeZone } from 'date-fns-tz';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SystemHealthResponse = {
    ok: boolean;
    timestamp: string;
    cronJobs: {
        shifts: {
            ok: boolean;
            openShiftsOlderThan2Days: number;
            lastCheckDate: string;
        };
        ratings: {
            ok: boolean;
            staffLastMetricDate: string | null;
            branchLastMetricDate: string | null;
            bizLastMetricDate: string | null;
            daysSinceLastMetric: number | null;
        };
    };
    apiMetrics: {
        ok: boolean;
        totalRequests: number;
        errorRate: number;
        avgDuration: number;
        p95Duration: number;
        p99Duration: number;
        recentErrors: number;
    };
    uiErrors: {
        ok: boolean;
        recentErrors: number;
        lastErrorDate: string | null;
    };
    integrations: {
        whatsapp: {
            ok: boolean;
            lastSuccessDate: string | null;
            recentFailures: number;
        };
        telegram: {
            ok: boolean;
            lastSuccessDate: string | null;
            recentFailures: number;
        };
    };
};

/**
 * GET /api/admin/system-health
 * Агрегированная панель здоровья системы
 * Объединяет статус cron-задач, API-метрики, ошибки UI и состояние интеграций
 */
export async function GET(req: Request) {
    return withErrorHandler('SystemHealth', async () => {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        // Проверяем, что пользователь — суперадмин
        const { data: superRow } = await supabase
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (!superRow) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        const admin = getServiceClient();
        const now = new Date();
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoYmd = formatInTimeZone(twoDaysAgo, TZ, 'yyyy-MM-dd');
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 1. Статус cron-задач (смены и рейтинги)
        const { data: openShifts } = await admin
            .from('staff_shifts')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'open')
            .lt('shift_date', twoDaysAgoYmd);

        const [{ data: staffMax }, { data: branchMax }, { data: bizMax }] = await Promise.all([
            admin
                .from('staff_day_metrics')
                .select('metric_date')
                .order('metric_date', { ascending: false })
                .limit(1)
                .maybeSingle(),
            admin
                .from('branch_day_metrics')
                .select('metric_date')
                .order('metric_date', { ascending: false })
                .limit(1)
                .maybeSingle(),
            admin
                .from('biz_day_metrics')
                .select('metric_date')
                .order('metric_date', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);

        const lastMetricDate =
            staffMax?.metric_date || branchMax?.metric_date || bizMax?.metric_date
                ? new Date(
                      Math.max(
                          staffMax?.metric_date ? new Date(staffMax.metric_date).getTime() : 0,
                          branchMax?.metric_date ? new Date(branchMax.metric_date).getTime() : 0,
                          bizMax?.metric_date ? new Date(bizMax.metric_date).getTime() : 0
                      )
                  )
                : null;

        let daysSinceLastMetric: number | null = null;
        if (lastMetricDate) {
            const diffMs = now.getTime() - lastMetricDate.getTime();
            daysSinceLastMetric = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        // 2. API-метрики (последний час)
        // Используем агрегированную статистику по всем endpoint за последний час
        let apiMetricsData: Array<{
            total_requests: number;
            error_rate: number;
            avg_duration_ms: number;
            p95_duration_ms: number;
            p99_duration_ms: number;
        }> | null = null;
        
        try {
            const { data, error: metricsError } = await admin.rpc('get_api_metrics_stats', {
                p_endpoint: '/api/staff/finance', // Используем популярный endpoint как пример
                p_window_minutes: 60,
                p_method: null,
            });

            if (metricsError) {
                logError('SystemHealth', 'Error fetching API metrics', metricsError);
            } else {
                apiMetricsData = data;
            }
        } catch (e) {
            logError('SystemHealth', 'Exception fetching API metrics', e);
        }

        const { data: recentApiErrors } = await admin
            .from('api_request_metrics')
            .select('id', { count: 'exact', head: true })
            .gte('status_code', 500)
            .gte('created_at', oneHourAgo.toISOString());

        // 3. Ошибки UI (используем API метрики с ошибками как прокси)
        // В будущем можно добавить отдельную таблицу для UI ошибок
        const { data: uiErrors } = await admin
            .from('api_request_metrics')
            .select('created_at')
            .gte('status_code', 500)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data: recentUiErrors } = await admin
            .from('api_request_metrics')
            .select('id', { count: 'exact', head: true })
            .gte('status_code', 500)
            .gte('created_at', oneDayAgo.toISOString());

        // 4. Состояние интеграций (WhatsApp и Telegram)
        // Проверяем последние успешные отправки через метрики API
        const { data: whatsappLastSuccess } = await admin
            .from('api_request_metrics')
            .select('created_at')
            .eq('endpoint', '/api/whatsapp/send-otp')
            .eq('status_code', 200)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data: whatsappRecentFailures } = await admin
            .from('api_request_metrics')
            .select('id', { count: 'exact', head: true })
            .eq('endpoint', '/api/whatsapp/send-otp')
            .gte('status_code', 400)
            .gte('created_at', oneDayAgo.toISOString());

        const { data: telegramLastSuccess } = await admin
            .from('api_request_metrics')
            .select('created_at')
            .or('endpoint.eq./api/auth/telegram/login,endpoint.eq./api/auth/telegram/link')
            .eq('status_code', 200)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data: telegramRecentFailures } = await admin
            .from('api_request_metrics')
            .select('id', { count: 'exact', head: true })
            .or('endpoint.eq./api/auth/telegram/login,endpoint.eq./api/auth/telegram/link')
            .gte('status_code', 400)
            .gte('created_at', oneDayAgo.toISOString());

        // Агрегируем метрики по всем endpoint за последний час
        const { data: allMetrics } = await admin
            .from('api_request_metrics')
            .select('status_code, duration_ms')
            .gte('created_at', oneHourAgo.toISOString());

        const totalRequests = allMetrics?.length || 0;
        const successCount = allMetrics?.filter(m => m.status_code >= 200 && m.status_code < 300).length || 0;
        const errorCount = allMetrics?.filter(m => m.status_code >= 400).length || 0;
        const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
        
        const durations = allMetrics?.map(m => m.duration_ms).filter((d): d is number => typeof d === 'number' && d > 0) || [];
        durations.sort((a, b) => a - b);
        const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const p95Index = Math.floor(durations.length * 0.95);
        const p99Index = Math.floor(durations.length * 0.99);
        const p95Duration = durations[p95Index] || 0;
        const p99Duration = durations[p99Index] || 0;

        const apiStats = {
            total_requests: totalRequests,
            error_rate: errorRate,
            avg_duration_ms: avgDuration,
            p95_duration_ms: p95Duration,
            p99_duration_ms: p99Duration,
        };

        const result: SystemHealthResponse = {
            ok: true,
            timestamp: now.toISOString(),
            cronJobs: {
                shifts: {
                    ok: (openShifts?.length ?? 0) === 0,
                    openShiftsOlderThan2Days: openShifts?.length ?? 0,
                    lastCheckDate: formatInTimeZone(now, TZ, 'yyyy-MM-dd'),
                },
                ratings: {
                    ok: lastMetricDate !== null && daysSinceLastMetric !== null && daysSinceLastMetric <= 2,
                    staffLastMetricDate: staffMax?.metric_date ?? null,
                    branchLastMetricDate: branchMax?.metric_date ?? null,
                    bizLastMetricDate: bizMax?.metric_date ?? null,
                    daysSinceLastMetric,
                },
            },
            apiMetrics: {
                ok: apiStats.error_rate < 5 && (recentApiErrors?.length ?? 0) < 10,
                totalRequests: apiStats.total_requests || 0,
                errorRate: apiStats.error_rate || 0,
                avgDuration: apiStats.avg_duration_ms || 0,
                p95Duration: apiStats.p95_duration_ms || 0,
                p99Duration: apiStats.p99_duration_ms || 0,
                recentErrors: recentApiErrors?.length ?? 0,
            },
            uiErrors: {
                ok: (recentUiErrors?.length ?? 0) < 5,
                recentErrors: recentUiErrors?.length ?? 0,
                lastErrorDate: uiErrors?.created_at ?? null,
            },
            integrations: {
                whatsapp: {
                    ok: whatsappLastSuccess !== null && (whatsappRecentFailures?.length ?? 0) < 5,
                    lastSuccessDate: whatsappLastSuccess?.created_at ?? null,
                    recentFailures: whatsappRecentFailures?.length ?? 0,
                },
                telegram: {
                    ok: telegramLastSuccess !== null && (telegramRecentFailures?.length ?? 0) < 5,
                    lastSuccessDate: telegramLastSuccess?.created_at ?? null,
                    recentFailures: telegramRecentFailures?.length ?? 0,
                },
            },
        };

        // Общий статус OK, если все компоненты в порядке
        result.ok =
            result.cronJobs.shifts.ok &&
            result.cronJobs.ratings.ok &&
            result.apiMetrics.ok &&
            result.uiErrors.ok &&
            result.integrations.whatsapp.ok &&
            result.integrations.telegram.ok;

        logDebug('SystemHealth', 'Health check completed', {
            ok: result.ok,
            timestamp: result.timestamp,
        });

        return createSuccessResponse(result);
    });
}

