import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;
const MAX_ERRORS = 100;

/**
 * GET /api/admin/ratings/debug-entities
 * Диагностика рейтингов: сущности без рейтинга, без метрик за последние N дней, последние ошибки пересчёта.
 * Доступно только суперадминам.
 *
 * Query: days (1–90) — окно «нет метрик за последние N дней», по умолчанию 7.
 */
export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () =>
            withErrorHandler('RatingsDebugEntities', async () => {
                const supabase = await createSupabaseServerClient();
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    return createErrorResponse('auth', 'Не авторизован', undefined, 401);
                }

                const { data: superRow, error: superErr } = await supabase
                    .from('user_roles_with_user')
                    .select('role_key,biz_id')
                    .eq('role_key', 'super_admin')
                    .is('biz_id', null)
                    .limit(1)
                    .maybeSingle();

                if (superErr) {
                    return createErrorResponse('internal', superErr.message, undefined, 400);
                }
                if (!superRow) {
                    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                }

                const url = new URL(req.url);
                const daysParam = url.searchParams.get('days');
                const days = Math.min(
                    MAX_DAYS,
                    Math.max(1, Number.parseInt(daysParam ?? String(DEFAULT_DAYS), 10) || DEFAULT_DAYS),
                );

                const admin = getServiceClient();

                const windowStart = new Date();
                windowStart.setDate(windowStart.getDate() - days);
                const windowStartStr = windowStart.toISOString().slice(0, 10);

                // 1. Сущности с rating_score IS NULL (с полями для отображения)
                const [
                    { data: staffNull },
                    { data: branchesNull },
                    { data: businessesNull },
                ] = await Promise.all([
                    admin
                        .from('staff')
                        .select('id, full_name, biz_id, branch_id')
                        .is('rating_score', null)
                        .order('full_name'),
                    admin
                        .from('branches')
                        .select('id, name, biz_id')
                        .is('rating_score', null)
                        .order('name'),
                    admin
                        .from('businesses')
                        .select('id, name, slug')
                        .is('rating_score', null)
                        .order('name'),
                ]);

                // 2. Активные сущности без метрик за последние N дней
                const [
                    { data: activeStaff },
                    { data: staffWithMetrics },
                    { data: activeBranches },
                    { data: branchesWithMetrics },
                    { data: approvedBiz },
                    { data: bizWithMetrics },
                ] = await Promise.all([
                    admin.from('staff').select('id').eq('is_active', true),
                    admin.from('staff_day_metrics').select('staff_id').gte('metric_date', windowStartStr),
                    admin.from('branches').select('id').eq('is_active', true),
                    admin.from('branch_day_metrics').select('branch_id').gte('metric_date', windowStartStr),
                    admin.from('businesses').select('id').eq('is_approved', true),
                    admin.from('biz_day_metrics').select('biz_id').gte('metric_date', windowStartStr),
                ]);

                const staffIdsWithMetrics = new Set((staffWithMetrics ?? []).map((r: { staff_id: string }) => r.staff_id));
                const branchIdsWithMetrics = new Set((branchesWithMetrics ?? []).map((r: { branch_id: string }) => r.branch_id));
                const bizIdsWithMetrics = new Set((bizWithMetrics ?? []).map((r: { biz_id: string }) => r.biz_id));

                const staffNoMetricsIds = (activeStaff ?? []).filter((r: { id: string }) => !staffIdsWithMetrics.has(r.id)).map((r: { id: string }) => r.id);
                const branchesNoMetricsIds = (activeBranches ?? []).filter((r: { id: string }) => !branchIdsWithMetrics.has(r.id)).map((r: { id: string }) => r.id);
                const bizNoMetricsIds = (approvedBiz ?? []).filter((r: { id: string }) => !bizIdsWithMetrics.has(r.id)).map((r: { id: string }) => r.id);

                let staffNoMetricsList: { id: string; full_name: string | null; biz_id: string; branch_id: string }[] = [];
                let branchesNoMetricsList: { id: string; name: string; biz_id: string }[] = [];
                let businessesNoMetricsList: { id: string; name: string | null; slug: string | null }[] = [];

                const limitNoMetrics = 500;
                if (staffNoMetricsIds.length > 0) {
                    const { data } = await admin
                        .from('staff')
                        .select('id, full_name, biz_id, branch_id')
                        .in('id', staffNoMetricsIds.slice(0, limitNoMetrics));
                    staffNoMetricsList = (data ?? []) as typeof staffNoMetricsList;
                }
                if (branchesNoMetricsIds.length > 0) {
                    const { data } = await admin
                        .from('branches')
                        .select('id, name, biz_id')
                        .in('id', branchesNoMetricsIds.slice(0, limitNoMetrics));
                    branchesNoMetricsList = (data ?? []) as typeof branchesNoMetricsList;
                }
                if (bizNoMetricsIds.length > 0) {
                    const { data } = await admin
                        .from('businesses')
                        .select('id, name, slug')
                        .in('id', bizNoMetricsIds.slice(0, limitNoMetrics));
                    businessesNoMetricsList = (data ?? []) as typeof businessesNoMetricsList;
                }

                // 3. Последние ошибки из rating_recalc_errors (если таблица есть)
                let recentErrors: unknown[] = [];
                try {
                    const { data } = await admin
                        .from('rating_recalc_errors')
                        .select('id, entity_id, entity_type, metric_date, error_message, created_at')
                        .order('created_at', { ascending: false })
                        .limit(MAX_ERRORS);
                    recentErrors = data ?? [];
                } catch {
                    recentErrors = [];
                }

                return createSuccessResponse({
                    days,
                    window_since: windowStartStr,
                    with_null_rating: {
                        staff: staffNull ?? [],
                        branches: branchesNull ?? [],
                        businesses: businessesNull ?? [],
                    },
                    without_metrics_since: {
                        staff: staffNoMetricsList,
                        branches: branchesNoMetricsList,
                        businesses: businessesNoMetricsList,
                        total_count: {
                            staff: staffNoMetricsIds.length,
                            branches: branchesNoMetricsIds.length,
                            businesses: bizNoMetricsIds.length,
                        },
                    },
                    recent_errors: recentErrors,
                });
            }),
    );
}
