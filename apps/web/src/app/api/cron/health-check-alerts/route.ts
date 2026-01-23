import { NextResponse } from 'next/server';

import { sendAlertEmail } from '@/lib/alerts';
import { logError, logDebug } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Проверка секретного ключа для безопасности
const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

/**
 * GET /api/cron/health-check-alerts
 * Cron job для периодической проверки здоровья системы и отправки алертов.
 * Запускается ежедневно в 09:00 UTC (14:00 Bishkek).
 *
 * Проверяет:
 * - Не закрылись ли смены
 * - Не пересчитались ли рейтинги
 * - Не перестали ли применяться промо
 *
 * Отправляет email-алерт, если обнаружены проблемы.
 */
export async function GET(req: Request) {
    try {
        // Проверяем секретный ключ для безопасности
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        logDebug('HealthCheckAlerts', 'Starting health check...');

        // Вызываем health check напрямую через service client
        // (вместо HTTP запроса, чтобы не зависеть от аутентификации)
        const { getServiceClient } = await import('@/lib/supabaseService');
        const admin = getServiceClient();
        const { formatInTimeZone } = await import('date-fns-tz');
        const { TZ } = await import('@/lib/time');

        const alerts: Array<{
            type: 'error' | 'warning';
            message: string;
            details?: Record<string, unknown>;
        }> = [];
        const now = new Date();
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoYmd = formatInTimeZone(twoDaysAgo, TZ, 'yyyy-MM-dd');

        // 1. Проверка незакрытых смен
        const { data: openShifts, error: shiftsError } = await admin
            .from('staff_shifts')
            .select('id, shift_date, staff_id')
            .eq('status', 'open')
            .lt('shift_date', twoDaysAgoYmd);

        if (shiftsError) {
            logError('HealthCheckAlerts', 'Error checking open shifts', shiftsError);
        }

        const openShiftsCount = openShifts?.length ?? 0;
        if (openShiftsCount > 0) {
            alerts.push({
                type: 'error',
                message: `Обнаружено ${openShiftsCount} незакрытых смен старше 2 дней`,
                details: {
                    count: openShiftsCount,
                    threshold: '2 days',
                },
            });
        }

        // 2. Проверка рейтингов
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

        // 3. Проверка промо
        const { data: lastPromoUsage, error: promoError } = await admin
            .from('client_promotion_usage')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (promoError) {
            logError('HealthCheckAlerts', 'Error checking promotion usage', promoError);
        }

        const { data: activePromotions, error: activePromoError } = await admin
            .from('branch_promotions')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true);

        if (activePromoError) {
            logError('HealthCheckAlerts', 'Error checking active promotions', activePromoError);
        }

        const lastPromoDate = lastPromoUsage?.created_at ? new Date(lastPromoUsage.created_at) : null;
        let daysSinceLastPromo: number | null = null;
        if (lastPromoDate) {
            const diffMs = now.getTime() - lastPromoDate.getTime();
            daysSinceLastPromo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        const activePromotionsCount = activePromotions?.length ?? 0;
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

        const healthData = {
            ok: alerts.length === 0,
            alerts,
            checks: {
                shifts: {
                    ok: openShiftsCount === 0,
                    openShiftsOlderThan2Days: openShiftsCount,
                    lastCheckDate: formatInTimeZone(now, TZ, 'yyyy-MM-dd'),
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
            },
        };

        logDebug('HealthCheckAlerts', 'Health check completed', {
            ok: healthData.ok,
            alertsCount: healthData.alerts.length,
        });

        // Если есть алерты, отправляем email
        if (healthData.alerts.length > 0) {
            logDebug('HealthCheckAlerts', 'Sending alert email...', {
                alertsCount: healthData.alerts.length,
            });

            const emailResult = await sendAlertEmail(healthData.alerts);

            if (!emailResult.success) {
                logError('HealthCheckAlerts', 'Failed to send alert email', emailResult.error);
                return NextResponse.json(
                    {
                        ok: false,
                        error: 'Health check found issues, but failed to send alert email',
                        healthCheck: healthData,
                        emailError: emailResult.error,
                    },
                    { status: 500 }
                );
            }

            logDebug('HealthCheckAlerts', 'Alert email sent successfully');
        } else {
            logDebug('HealthCheckAlerts', 'No alerts, system is healthy');
        }

        return NextResponse.json({
            ok: true,
            healthCheck: healthData,
            alertSent: healthData.alerts.length > 0,
        });
    } catch (error) {
        logError('HealthCheckAlerts', 'Unexpected error', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

