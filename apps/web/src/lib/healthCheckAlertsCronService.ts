type Alert = {
    type: 'error' | 'warning';
    message: string;
    details?: Record<string, unknown>;
};

type AdminClientLike = {
    from: (table: string) => any;
};

type EmailSenderLike = (alerts: Alert[]) => Promise<{ success: boolean; error?: string }>;

export async function runHealthCheckAlerts({
    admin,
    formatDate,
    tz,
    now,
    sendAlertEmail,
}: {
    admin: AdminClientLike;
    formatDate: (date: Date, tz: string, format: string) => string;
    tz: string;
    now: Date;
    sendAlertEmail: EmailSenderLike;
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
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoYmd = formatDate(twoDaysAgo, tz, 'yyyy-MM-dd');

    const { data: openShifts } = await admin
        .from('staff_shifts')
        .select('id, shift_date, staff_id')
        .eq('status', 'open')
        .lt('shift_date', twoDaysAgoYmd);

    const openShiftsCount = openShifts?.length ?? 0;
    if (openShiftsCount > 0) {
        alerts.push({
            type: 'error',
            message: `Обнаружено ${openShiftsCount} незакрытых смен старше 2 дней`,
            details: { count: openShiftsCount, threshold: '2 days' },
        });
    }

    const [{ data: staffMax }, { data: branchMax }, { data: bizMax }] = await Promise.all([
        admin.from('staff_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
        admin.from('branch_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
        admin.from('biz_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const lastMetricDate =
        staffMax?.metric_date || branchMax?.metric_date || bizMax?.metric_date
            ? new Date(
                  Math.max(
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

    const { data: lastPromoUsage } = await admin
        .from('client_promotion_usage')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const { data: activePromotions } = await admin
        .from('branch_promotions')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

    const lastPromoDate = lastPromoUsage?.created_at ? new Date(lastPromoUsage.created_at) : null;
    const daysSinceLastPromo =
        lastPromoDate == null ? null : Math.floor((now.getTime() - lastPromoDate.getTime()) / (1000 * 60 * 60 * 24));
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

    const healthCheck = {
        ok: alerts.length === 0,
        alerts,
        checks: {
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
        },
    };

    if (healthCheck.alerts.length > 0) {
        const emailResult = await sendAlertEmail(healthCheck.alerts);
        if (!emailResult.success) {
            return {
                ok: false,
                error: 'internal',
                message: 'Health check found issues, but failed to send alert email',
                details: {
                    healthCheck,
                    emailError: emailResult.error,
                },
                status: 500,
            };
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
