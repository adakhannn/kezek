import type { BackgroundQueueHealth } from '@/lib/backgroundQueueHealth';
import type { CronHealthStatus } from '@/lib/cronExecutionHealth';
import { logError } from '@/lib/log';
import type { DbTableClient } from '@/lib/supabaseTypes';

type Alert = {
    type: 'error' | 'warning';
    message: string;
    details?: Record<string, unknown>;
};

type DbError = { message?: string } | null;
type QueryResult<T> = {
    data: T | null;
    count?: number | null;
    error?: DbError;
};

type AdminClient = DbTableClient;

type EmailSenderLike = (alerts: Alert[]) => Promise<{ success: boolean; error?: string }>;

const TELEGRAM_ALERT_WINDOW_HOURS = 24;
const TELEGRAM_FAILURE_GROWTH_MIN_DELTA = 5;
const TELEGRAM_FAILURE_GROWTH_MULTIPLIER = 1.5;
const TELEGRAM_APPROVED_RATE_MIN = 0.6;
const TELEGRAM_APPROVED_RATE_DROP_DELTA = 0.15;
const GOOGLE_ALERT_WINDOW_HOURS = 24;
const GOOGLE_FAILURE_GROWTH_MIN_DELTA = 5;
const GOOGLE_FAILURE_GROWTH_MULTIPLIER = 1.5;
const GOOGLE_SUCCESS_RATE_MIN = 0.6;
const GOOGLE_SUCCESS_RATE_DROP_DELTA = 0.15;

function toIso(date: Date) {
    return date.toISOString();
}

function checkedData<T>(response: QueryResult<T>, source: string): T | null {
    if (response.error) throw new Error(`HEALTH_SOURCE_UNAVAILABLE:${source}`, { cause: response.error });
    return response.data;
}

function checkedCount(response: QueryResult<unknown>, source: string): number {
    if (response.error || !Number.isSafeInteger(response.count) || response.count == null || response.count < 0) {
        throw new Error(`HEALTH_COUNT_UNAVAILABLE:${source}`, { cause: response.error ?? undefined });
    }
    return response.count;
}

async function getAnalyticsEventCount(
    admin: AdminClient,
    eventType: string,
    fromIso: string,
    toIsoValue: string,
): Promise<number> {
    const response = await admin
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', eventType)
        .gte('created_at', fromIso)
        .lt('created_at', toIsoValue);

    return checkedCount(response, 'analytics_events');
}

export async function runHealthCheckAlerts(params: Parameters<typeof collectHealthCheckAlerts>[0]): ReturnType<typeof collectHealthCheckAlerts> {
    try { return await collectHealthCheckAlerts(params); }
    catch (error) {
        logError('HealthCheckAlerts', 'Health check source data is unavailable', error);
        return { ok: false, error: 'internal', message: 'Health check source data is unavailable', status: 500 };
    }
}

async function collectHealthCheckAlerts({
    admin,
    formatDate,
    tz,
    now,
    sendAlertEmail,
    cronStatuses = [],
    queueStatuses = [],
}: {
    admin: AdminClient;
    formatDate: (date: Date, tz: string, format: string) => string;
    tz: string;
    now: Date;
    sendAlertEmail: EmailSenderLike;
    cronStatuses?: CronHealthStatus[];
    queueStatuses?: BackgroundQueueHealth[];
}): Promise<
    | {
          ok: true;
          data: {
              healthCheck: {
                  ok: boolean;
                  alerts: Alert[];
                  checks: Record<string, unknown>;
              };
              alertSent: boolean;
              /** Why the alert e-mail was not sent; the alerts went to Sentry instead. */
              emailError?: string;
          };
      }
    | {
          ok: false;
          error: 'internal';
          message: string;
          details?: unknown;
          status: 500;
      }
> {
    const alerts: Alert[] = [];
    const unhealthyQueues = queueStatuses.filter(queue => queue.status === 'failed' || queue.status === 'backlog');
    for (const queue of unhealthyQueues) alerts.push({ type: 'error', message: `Queue ${queue.job}: ${queue.status}`, details: { ...queue } });
    const unhealthyCron = cronStatuses.filter(job => ['failed', 'stuck', 'overdue', 'unobserved'].includes(job.status));
    for (const job of unhealthyCron) {
        alerts.push({ type: job.status === 'unobserved' ? 'warning' : 'error',
            message: `Cron ${job.job}: ${job.status}`, details: { ...job } });
    }
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoYmd = formatDate(twoDaysAgo, tz, 'yyyy-MM-dd');

    const openShifts = await admin
        .from('staff_shifts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .lt('shift_date', twoDaysAgoYmd);

    const openShiftsCount = checkedCount(openShifts, 'staff_shifts');
    if (openShiftsCount > 0) {
        alerts.push({
            type: 'error',
            message: `Обнаружено ${openShiftsCount} незакрытых смен старше 2 дней`,
            details: { count: openShiftsCount, threshold: '2 days' },
        });
    }

    const [staffResult, branchResult, bizResult] = await Promise.all([
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
    const staffMax = checkedData(staffResult, 'staff_day_metrics');
    const branchMax = checkedData(branchResult, 'branch_day_metrics');
    const bizMax = checkedData(bizResult, 'biz_day_metrics');

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

    const daysSinceLastMetric =
        lastMetricDate == null ? null : Math.floor((now.getTime() - lastMetricDate.getTime()) / (1000 * 60 * 60 * 24));

    if (lastMetricDate === null || (daysSinceLastMetric !== null && daysSinceLastMetric > 2)) {
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

    const promoResult = await admin
        .from('client_promotion_usage')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    const lastPromoUsage = checkedData(promoResult, 'client_promotion_usage');

    const activePromotions = await admin
        .from('branch_promotions')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

    const lastPromoDate = lastPromoUsage?.created_at ? new Date(lastPromoUsage.created_at) : null;
    const daysSinceLastPromo =
        lastPromoDate == null ? null : Math.floor((now.getTime() - lastPromoDate.getTime()) / (1000 * 60 * 60 * 24));
    const activePromotionsCount = checkedCount(activePromotions, 'branch_promotions');

    if (activePromotionsCount > 0 && (lastPromoDate === null || (daysSinceLastPromo !== null && daysSinceLastPromo > 7))) {
        alerts.push({
            type: 'warning',
            message: `Активные промо есть (${activePromotionsCount}), но последнее применение было ${daysSinceLastPromo ?? 'никогда'} дней назад`,
            details: {
                activePromotionsCount,
                lastPromoDate: lastPromoDate?.toISOString() ?? null,
                daysSinceLastPromo,
            },
        });
    }

    const currentWindowEnd = now;
    const currentWindowStart = new Date(
        now.getTime() - TELEGRAM_ALERT_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const previousWindowStart = new Date(
        currentWindowStart.getTime() - TELEGRAM_ALERT_WINDOW_HOURS * 60 * 60 * 1000,
    );

    const [
        currentFailed,
        currentExpired,
        currentApproved,
        previousFailed,
        previousExpired,
        previousApproved,
    ] = await Promise.all([
        getAnalyticsEventCount(
            admin,
            'telegram_mobile_login_failed',
            toIso(currentWindowStart),
            toIso(currentWindowEnd),
        ),
        getAnalyticsEventCount(
            admin,
            'telegram_mobile_login_expired',
            toIso(currentWindowStart),
            toIso(currentWindowEnd),
        ),
        getAnalyticsEventCount(
            admin,
            'telegram_mobile_login_approved',
            toIso(currentWindowStart),
            toIso(currentWindowEnd),
        ),
        getAnalyticsEventCount(
            admin,
            'telegram_mobile_login_failed',
            toIso(previousWindowStart),
            toIso(currentWindowStart),
        ),
        getAnalyticsEventCount(
            admin,
            'telegram_mobile_login_expired',
            toIso(previousWindowStart),
            toIso(currentWindowStart),
        ),
        getAnalyticsEventCount(
            admin,
            'telegram_mobile_login_approved',
            toIso(previousWindowStart),
            toIso(currentWindowStart),
        ),
    ]);

    const currentNegative = currentFailed + currentExpired;
    const previousNegative = previousFailed + previousExpired;
    const currentTotal = currentNegative + currentApproved;
    const previousTotal = previousNegative + previousApproved;
    const currentApprovedRate = currentTotal > 0 ? currentApproved / currentTotal : null;
    const previousApprovedRate = previousTotal > 0 ? previousApproved / previousTotal : null;

    const negativeGrowthTriggered =
        currentNegative >= previousNegative * TELEGRAM_FAILURE_GROWTH_MULTIPLIER &&
        currentNegative - previousNegative >= TELEGRAM_FAILURE_GROWTH_MIN_DELTA;

    if (negativeGrowthTriggered) {
        alerts.push({
            type: 'warning',
            message:
                'Рост telegram mobile login ошибок: increased failed/expired attempts in the last 24h window',
            details: {
                windowHours: TELEGRAM_ALERT_WINDOW_HOURS,
                current: {
                    failed: currentFailed,
                    expired: currentExpired,
                    negative: currentNegative,
                },
                previous: {
                    failed: previousFailed,
                    expired: previousExpired,
                    negative: previousNegative,
                },
            },
        });
    }

    if (
        currentApprovedRate !== null &&
        previousApprovedRate !== null &&
        currentApprovedRate < TELEGRAM_APPROVED_RATE_MIN &&
        previousApprovedRate - currentApprovedRate >= TELEGRAM_APPROVED_RATE_DROP_DELTA
    ) {
        alerts.push({
            type: 'error',
            message:
                'Падение telegram mobile login approved rate detected',
            details: {
                windowHours: TELEGRAM_ALERT_WINDOW_HOURS,
                currentApprovedRate,
                previousApprovedRate,
                current: {
                    approved: currentApproved,
                    failed: currentFailed,
                    expired: currentExpired,
                    total: currentTotal,
                },
                previous: {
                    approved: previousApproved,
                    failed: previousFailed,
                    expired: previousExpired,
                    total: previousTotal,
                },
            },
        });
    }

    const googleCurrentWindowEnd = now;
    const googleCurrentWindowStart = new Date(
        now.getTime() - GOOGLE_ALERT_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const googlePreviousWindowStart = new Date(
        googleCurrentWindowStart.getTime() - GOOGLE_ALERT_WINDOW_HOURS * 60 * 60 * 1000,
    );

    const [googleCurrentFailed, googleCurrentSuccess, googlePreviousFailed, googlePreviousSuccess] =
        await Promise.all([
            getAnalyticsEventCount(
                admin,
                'mobile_google_login_failed',
                toIso(googleCurrentWindowStart),
                toIso(googleCurrentWindowEnd),
            ),
            getAnalyticsEventCount(
                admin,
                'mobile_google_login_success',
                toIso(googleCurrentWindowStart),
                toIso(googleCurrentWindowEnd),
            ),
            getAnalyticsEventCount(
                admin,
                'mobile_google_login_failed',
                toIso(googlePreviousWindowStart),
                toIso(googleCurrentWindowStart),
            ),
            getAnalyticsEventCount(
                admin,
                'mobile_google_login_success',
                toIso(googlePreviousWindowStart),
                toIso(googleCurrentWindowStart),
            ),
        ]);

    const googleCurrentTotal = googleCurrentFailed + googleCurrentSuccess;
    const googlePreviousTotal = googlePreviousFailed + googlePreviousSuccess;
    const googleCurrentSuccessRate =
        googleCurrentTotal > 0 ? googleCurrentSuccess / googleCurrentTotal : null;
    const googlePreviousSuccessRate =
        googlePreviousTotal > 0 ? googlePreviousSuccess / googlePreviousTotal : null;

    const googleFailedGrowthTriggered =
        googleCurrentFailed >= googlePreviousFailed * GOOGLE_FAILURE_GROWTH_MULTIPLIER &&
        googleCurrentFailed - googlePreviousFailed >= GOOGLE_FAILURE_GROWTH_MIN_DELTA;

    if (googleFailedGrowthTriggered) {
        alerts.push({
            type: 'warning',
            message:
                'Growth in mobile Google login failures: failed attempts increased in the last 24h window',
            details: {
                windowHours: GOOGLE_ALERT_WINDOW_HOURS,
                current: {
                    failed: googleCurrentFailed,
                },
                previous: {
                    failed: googlePreviousFailed,
                },
            },
        });
    }

    const googleSuccessRateDropTriggered =
        googleCurrentSuccessRate !== null &&
        googlePreviousSuccessRate !== null &&
        googleCurrentSuccessRate < GOOGLE_SUCCESS_RATE_MIN &&
        googlePreviousSuccessRate - googleCurrentSuccessRate >=
            GOOGLE_SUCCESS_RATE_DROP_DELTA;

    if (googleSuccessRateDropTriggered) {
        alerts.push({
            type: 'error',
            message: 'Drop in mobile Google login success rate detected',
            details: {
                windowHours: GOOGLE_ALERT_WINDOW_HOURS,
                currentSuccessRate: googleCurrentSuccessRate,
                previousSuccessRate: googlePreviousSuccessRate,
                current: {
                    success: googleCurrentSuccess,
                    failed: googleCurrentFailed,
                    total: googleCurrentTotal,
                },
                previous: {
                    success: googlePreviousSuccess,
                    failed: googlePreviousFailed,
                    total: googlePreviousTotal,
                },
            },
        });
    }

    const healthCheck = {
        ok: alerts.length === 0,
        alerts,
        checks: {
            cronExecutions: { ok: unhealthyCron.length === 0, jobs: cronStatuses },
            backgroundQueues: { ok: unhealthyQueues.length === 0, queues: queueStatuses },
            shifts: {
                ok: openShiftsCount === 0,
                openShiftsOlderThan2Days: openShiftsCount,
                lastCheckDate: formatDate(now, tz, 'yyyy-MM-dd'),
            },
            ratings: {
                ok: lastMetricDate !== null && daysSinceLastMetric !== null && daysSinceLastMetric <= 2,
                staffLastMetricDate: staffMax?.metric_date ?? null,
                branchLastMetricDate: branchMax?.metric_date ?? null,
                bizLastMetricDate: bizMax?.metric_date ?? null,
                daysSinceLastMetric,
            },
            promotions: {
                ok:
                    activePromotionsCount === 0 ||
                    (lastPromoDate !== null && daysSinceLastPromo !== null && daysSinceLastPromo <= 7),
                lastAppliedDate: lastPromoDate?.toISOString() ?? null,
                daysSinceLastApplication: daysSinceLastPromo,
                activePromotionsCount,
            },
            telegramMobileAuth: {
                ok:
                    !negativeGrowthTriggered &&
                    !(
                        currentApprovedRate !== null &&
                        previousApprovedRate !== null &&
                        currentApprovedRate < TELEGRAM_APPROVED_RATE_MIN &&
                        previousApprovedRate - currentApprovedRate >=
                            TELEGRAM_APPROVED_RATE_DROP_DELTA
                    ),
                windowHours: TELEGRAM_ALERT_WINDOW_HOURS,
                current: {
                    approved: currentApproved,
                    failed: currentFailed,
                    expired: currentExpired,
                    approvedRate: currentApprovedRate,
                },
                previous: {
                    approved: previousApproved,
                    failed: previousFailed,
                    expired: previousExpired,
                    approvedRate: previousApprovedRate,
                },
            },
            googleMobileAuth: {
                ok: !googleFailedGrowthTriggered && !googleSuccessRateDropTriggered,
                windowHours: GOOGLE_ALERT_WINDOW_HOURS,
                current: {
                    success: googleCurrentSuccess,
                    failed: googleCurrentFailed,
                    successRate: googleCurrentSuccessRate,
                },
                previous: {
                    success: googlePreviousSuccess,
                    failed: googlePreviousFailed,
                    successRate: googlePreviousSuccessRate,
                },
            },
        },
    };

    if (healthCheck.alerts.length > 0) {
        const emailResult = await sendAlertEmail(healthCheck.alerts);
        if (!emailResult.success) {
            // Without the alert inbox each problem still reaches the owner as its own Sentry issue;
            // otherwise Sentry only showed "failed to send alert email" with the details collapsed.
            for (const alert of healthCheck.alerts) {
                logError('HealthCheckAlert', `[${alert.type}] ${alert.message}`, alert.details);
            }
            // The check itself ran and its findings reached Sentry: answering 500 here made the cron
            // record the health check as failed every day it found something (last success 17 Nov).
            return { ok: true, data: { healthCheck, alertSent: false, emailError: emailResult.error } };
        }
    }

    return {
        ok: true,
        data: {
            healthCheck,
            alertSent: healthCheck.alerts.length > 0,
        },
    };
}
