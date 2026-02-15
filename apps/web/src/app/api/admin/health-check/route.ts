import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { logError } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type HealthCheckResult = {
    ok: boolean;
    alerts: Array<{
        type: 'error' | 'warning';
        message: string;
        details?: Record<string, unknown>;
    }>;
    checks: {
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

/**
 * GET /api/admin/health-check
 * Комплексная проверка здоровья системы.
 * Доступно только суперадминам.
 *
 * Проверяет:
 * - Не закрылись ли смены (открытые смены старше 2 дней)
 * - Не пересчитались ли рейтинги (последняя метрика старше 2 дней)
 * - Не перестали ли применяться промо (последнее применение старше 7 дней)
 */
export async function GET() {
    try {
        // Используем унифицированную утилиту для создания Supabase клиента
        const supabase = await createSupabaseServerClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
        }

        // Проверяем, что пользователь — суперадмин
        const { data: superRow, error: superErr } = await supabase
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (superErr) {
            return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        }
        if (!superRow) {
            return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
        }

        const admin = getServiceClient();
        const alerts: HealthCheckResult['alerts'] = [];
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
            logError('HealthCheck', 'Error checking open shifts', shiftsError);
        }

        const openShiftsCount = openShifts?.length ?? 0;
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

        // 3. Проверка промо
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: lastPromoUsage, error: promoError } = await admin
            .from('client_promotion_usage')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (promoError) {
            logError('HealthCheck', 'Error checking promotion usage', promoError);
        }

        const { data: activePromotions, error: activePromoError } = await admin
            .from('branch_promotions')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true);

        if (activePromoError) {
            logError('HealthCheck', 'Error checking active promotions', activePromoError);
        }

        const lastPromoDate = lastPromoUsage?.created_at ? new Date(lastPromoUsage.created_at) : null;
        let daysSinceLastPromo: number | null = null;
        if (lastPromoDate) {
            const diffMs = now.getTime() - lastPromoDate.getTime();
            daysSinceLastPromo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        const activePromotionsCount = activePromotions?.length ?? 0;
        // Промо OK, если либо нет активных промо, либо последнее применение было не более 7 дней назад
        const promotionsOk =
            activePromotionsCount === 0 || (lastPromoDate !== null && daysSinceLastPromo !== null && daysSinceLastPromo <= 7);

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

        const result: HealthCheckResult = {
            ok: shiftsOk && ratingsOk && promotionsOk,
            alerts,
            checks: {
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
        };

        return NextResponse.json(result);
    } catch (error) {
        logError('HealthCheck', 'Unexpected error', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

