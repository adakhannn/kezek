import type { SupabaseClient } from '@supabase/supabase-js';
import { formatInTimeZone } from 'date-fns-tz';

import { readBackgroundQueueHealth, type BackgroundQueueHealth } from '@/lib/backgroundQueueHealth';
import { readCronExecutionHealth, type CronHealthStatus } from '@/lib/cronExecutionHealth';
import { logError } from '@/lib/log';
import { TZ } from '@/lib/time';

type HealthStatus = 'ok' | 'degraded' | 'fail';

type ServiceSection = {
    status: HealthStatus;
    details?: Record<string, unknown>;
};

type HealthCheckResult = {
    ok: boolean;
    timestamp: string;
    alerts: Array<{
        type: 'error' | 'warning';
        message: string;
        details?: Record<string, unknown>;
    }>;
    services: {
        core: ServiceSection;
        supabase: ServiceSection;
        email: ServiceSection;
        whatsapp: ServiceSection;
        redis: ServiceSection;
    };
    checks: {
        cronExecutions: { ok: boolean; jobs: CronHealthStatus[] };
        backgroundQueues: { ok: boolean; queues: BackgroundQueueHealth[] };
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
        promotions: {
            ok: boolean;
            lastAppliedDate: string | null;
            daysSinceLastApplication: number | null;
            activePromotionsCount: number;
        };
    };
};

type Result =
    | { ok: false; statusCode: 500; errorType: 'internal'; message: string }
    | { ok: true; data: HealthCheckResult };

export async function runAdminHealthCheck({ admin }: { admin: Pick<SupabaseClient, 'from' | 'rpc' | 'auth'> }): Promise<Result> {
    const alerts: HealthCheckResult['alerts'] = [];
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoYmd = formatInTimeZone(twoDaysAgo, TZ, 'yyyy-MM-dd');

    const { count: openShiftsCount, error: shiftsError } = await admin
        .from('staff_shifts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .lt('shift_date', twoDaysAgoYmd);

    if (shiftsError || openShiftsCount === null || !Number.isSafeInteger(openShiftsCount) || openShiftsCount < 0) {
        logError('HealthCheck', 'Error checking open shifts', shiftsError);
        return { ok: false, statusCode: 500, errorType: 'internal', message: 'Shift health data is unavailable' };
    }

    const shiftsOk = openShiftsCount === 0;
    if (!shiftsOk) {
        alerts.push({
            type: 'error',
            message: `Обнаружено ${openShiftsCount} незакрытых смен старше 2 дней`,
            details: {
                count: openShiftsCount,
                threshold: '2 days',
            },
        });
    }

    const [{ data: staffMax, error: staffError }, { data: branchMax, error: branchError }, { data: bizMax, error: bizError }] = await Promise.all([
        admin.from('staff_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
        admin.from('branch_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
        admin.from('biz_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (staffError || branchError || bizError) {
        return { ok: false, statusCode: 500, errorType: 'internal', message: 'Rating health data is unavailable' };
    }

    const lastMetricDate =
        staffMax?.metric_date && branchMax?.metric_date && bizMax?.metric_date
            ? new Date(
                  Math.min(
                      staffMax?.metric_date ? new Date(staffMax.metric_date).getTime() : 0,
                      branchMax?.metric_date ? new Date(branchMax.metric_date).getTime() : 0,
                      bizMax?.metric_date ? new Date(bizMax.metric_date).getTime() : 0,
                  ),
              )
            : null;

    let daysSinceLastMetric: number | null = null;
    if (lastMetricDate) {
        daysSinceLastMetric = Math.floor((now.getTime() - lastMetricDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    const ratingsOk = lastMetricDate !== null && daysSinceLastMetric !== null && daysSinceLastMetric <= 2;
    if (!ratingsOk) {
        alerts.push({
            type: lastMetricDate === null ? 'error' : 'warning',
            message:
                lastMetricDate === null
                    ? 'Рейтинги никогда не пересчитывались'
                    : `Последний пересчет рейтингов был ${daysSinceLastMetric} дней назад`,
            details: {
                lastMetricDate: lastMetricDate?.toISOString() ?? null,
                daysSinceLastMetric,
            },
        });
    }

    const { data: lastPromoUsage, error: promoError } = await admin
        .from('client_promotion_usage')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (promoError) {
        logError('HealthCheck', 'Error checking promotion usage', promoError);
        return { ok: false, statusCode: 500, errorType: 'internal', message: 'Promotion health data is unavailable' };
    }

    const { count: activePromotionsCount, error: activePromoError } = await admin
        .from('branch_promotions')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

    if (activePromoError || activePromotionsCount === null || !Number.isSafeInteger(activePromotionsCount) || activePromotionsCount < 0) {
        logError('HealthCheck', 'Error checking active promotions', activePromoError);
        return { ok: false, statusCode: 500, errorType: 'internal', message: 'Promotion count is unavailable' };
    }

    const lastPromoDate = lastPromoUsage?.created_at ? new Date(lastPromoUsage.created_at) : null;
    let daysSinceLastPromo: number | null = null;
    if (lastPromoDate) {
        daysSinceLastPromo = Math.floor((now.getTime() - lastPromoDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    const promotionsOk =
        activePromotionsCount === 0 ||
        (lastPromoDate !== null && daysSinceLastPromo !== null && daysSinceLastPromo <= 7);

    if (!promotionsOk && activePromotionsCount > 0) {
        alerts.push({
            type: 'warning',
            message: `Активные промо есть (${activePromotionsCount}), но последнее применение было ${daysSinceLastPromo} дней назад`,
            details: {
                activePromotionsCount,
                lastPromoDate: lastPromoDate?.toISOString() ?? null,
                daysSinceLastPromo,
            },
        });
    }

    let cronStatuses: CronHealthStatus[];
    let queueStatuses: BackgroundQueueHealth[];
    try { [cronStatuses, queueStatuses] = await Promise.all([readCronExecutionHealth(admin, now), readBackgroundQueueHealth(admin)]); }
    catch { return { ok: false, statusCode: 500, errorType: 'internal', message: 'Cron health data is unavailable' }; }
    const unhealthyCron = cronStatuses.filter(job => ['failed', 'stuck', 'overdue', 'unobserved'].includes(job.status));
    for (const job of unhealthyCron) alerts.push({ type: job.status === 'unobserved' ? 'warning' : 'error',
        message: `Cron ${job.job}: ${job.status}`, details: { ...job } });
    const unhealthyQueues = queueStatuses.filter(queue => queue.status === 'failed' || queue.status === 'backlog');
    for (const queue of unhealthyQueues) alerts.push({ type: 'error', message: `Queue ${queue.job}: ${queue.status}`, details: { ...queue } });
    const coreOk = shiftsOk && ratingsOk && promotionsOk && unhealthyCron.length === 0 && unhealthyQueues.length === 0;

    return {
        ok: true,
        data: {
            ok: coreOk,
            timestamp: now.toISOString(),
            alerts,
            services: {
                core: {
                    status: coreOk ? 'ok' : alerts.some((alert) => alert.type === 'error') ? 'fail' : 'degraded',
                    details: {
                        shiftsOk,
                        ratingsOk,
                        promotionsOk,
                    },
                },
                supabase: { status: 'ok' },
                email: {
                    status: 'degraded',
                    details: {
                        note: 'Delivery health is recorded by the booking outbox worker; this endpoint does not send a probe email',
                    },
                },
                whatsapp: {
                    status: 'degraded',
                    details: {
                        note: 'Интеграция проверяется через /api/webhooks/whatsapp и диагностические endpoints',
                    },
                },
                redis: {
                    status: 'degraded',
                    details: {
                        note: 'Rate limiting использует Upstash Redis, но health этого сервиса проверяется отдельно при выполнении запросов',
                    },
                },
            },
            checks: {
                cronExecutions: { ok: unhealthyCron.length === 0, jobs: cronStatuses },
                backgroundQueues: { ok: unhealthyQueues.length === 0, queues: queueStatuses },
                shifts: {
                    ok: shiftsOk,
                    openShiftsOlderThan2Days: openShiftsCount,
                    lastCheckDate: formatInTimeZone(now, TZ, 'yyyy-MM-dd'),
                },
                ratings: {
                    ok: ratingsOk,
                    staffLastMetricDate: staffMax?.metric_date ?? null,
                    branchLastMetricDate: branchMax?.metric_date ?? null,
                    bizLastMetricDate: bizMax?.metric_date ?? null,
                    daysSinceLastMetric,
                },
                promotions: {
                    ok: promotionsOk,
                    lastAppliedDate: lastPromoDate?.toISOString() ?? null,
                    daysSinceLastApplication: daysSinceLastPromo,
                    activePromotionsCount,
                },
            },
        },
    };
}

