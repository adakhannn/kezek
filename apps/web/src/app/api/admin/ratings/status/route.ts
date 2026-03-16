import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/ratings/status
 * Краткий "health-check" для системы рейтингов.
 * Доступно только суперадминам.
 *
 * Возвращает:
 * - последнюю дату, по которой есть метрики для staff/branches/businesses;
 * - количество записей без rating_score;
 * - агрегированную информацию по недавним ошибкам пересчёта рейтингов.
 */
export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('RatingsStatus', async () => {
        // Используем унифицированную утилиту для создания Supabase клиента
        const supabase = await createSupabaseServerClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
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
            return createErrorResponse('internal', superErr.message, undefined, 400);
        }
        if (!superRow) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        const admin = getServiceClient();

        // Последние даты метрик по уровням и последнего успешного пересчёта рейтинга
        const [
            { data: staffMax },
            { data: branchMax },
            { data: bizMax },
            { data: staffLastRating },
            { data: branchLastRating },
            { data: bizLastRating },
        ] = await Promise.all([
            admin.from('staff_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
            admin.from('branch_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
            admin.from('biz_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
            admin.from('staff').select('last_rating_recalculated_at').order('last_rating_recalculated_at', { ascending: false }).not('last_rating_recalculated_at', 'is', null).limit(1).maybeSingle(),
            admin.from('branches').select('last_rating_recalculated_at').order('last_rating_recalculated_at', { ascending: false }).not('last_rating_recalculated_at', 'is', null).limit(1).maybeSingle(),
            admin.from('businesses').select('last_rating_recalculated_at').order('last_rating_recalculated_at', { ascending: false }).not('last_rating_recalculated_at', 'is', null).limit(1).maybeSingle(),
        ]);

        // Количество записей без выставленного rating_score (только IS NULL; 0 — валидный рейтинг)
        const [
            { count: staffNoRating },
            { count: branchesNoRating },
            { count: bizNoRating },
        ] = await Promise.all([
            admin.from('staff').select('id', { count: 'exact', head: true }).is('rating_score', null),
            admin.from('branches').select('id', { count: 'exact', head: true }).is('rating_score', null),
            admin.from('businesses').select('id', { count: 'exact', head: true }).is('rating_score', null),
        ]);

        // Агрегированная информация по недавним ошибкам пересчёта рейтингов (за последние N дней)
        const MAX_DAYS = 7;
        const errorsWindowDaysParam = new URL(req.url).searchParams.get('errors_days');
        const errorsWindowDays = Math.min(
            MAX_DAYS,
            Math.max(1, Number.parseInt(errorsWindowDaysParam ?? String(MAX_DAYS), 10) || MAX_DAYS),
        );

        const errorsSinceDate = new Date();
        errorsSinceDate.setDate(errorsSinceDate.getDate() - errorsWindowDays + 1);
        const errorsSinceIso = errorsSinceDate.toISOString().slice(0, 10);

        let recentErrorsTotal = 0;
        let recentErrorsByType: Record<string, number> = {};

        try {
            const { data: recentErrors } = await admin
                .from('rating_recalc_errors')
                .select('entity_type, metric_date')
                .gte('metric_date', errorsSinceIso);

            if (recentErrors && recentErrors.length > 0) {
                recentErrorsTotal = recentErrors.length;
                const byType: Record<string, number> = {};
                for (const row of recentErrors as { entity_type: string }[]) {
                    byType[row.entity_type] = (byType[row.entity_type] ?? 0) + 1;
                }
                recentErrorsByType = byType;
            }
        } catch {
            // Таблица может отсутствовать на старых инстансах; в этом случае оставляем ошибки как 0.
            recentErrorsTotal = 0;
            recentErrorsByType = {};
        }

        const hasRecentErrors = recentErrorsTotal > 0;

        return createSuccessResponse({
            staff_last_metric_date: staffMax?.metric_date ?? null,
            branch_last_metric_date: branchMax?.metric_date ?? null,
            biz_last_metric_date: bizMax?.metric_date ?? null,
            staff_last_rating_recalculated_at: staffLastRating?.last_rating_recalculated_at ?? null,
            branch_last_rating_recalculated_at: branchLastRating?.last_rating_recalculated_at ?? null,
            biz_last_rating_recalculated_at: bizLastRating?.last_rating_recalculated_at ?? null,
            staff_without_rating: staffNoRating ?? null,
            branches_without_rating: branchesNoRating ?? null,
            businesses_without_rating: bizNoRating ?? null,
            recent_errors_total: recentErrorsTotal,
            recent_errors_by_type: recentErrorsByType,
            recent_errors_days: errorsWindowDays,
            has_recent_errors: hasRecentErrors,
        });
    }));
}


