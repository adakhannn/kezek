import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
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
 * - признак, что данные в целом есть.
 */
export async function GET() {
    return withErrorHandler('RatingsStatus', async () => {
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

        // Последние даты метрик по уровням
        const [{ data: staffMax }, { data: branchMax }, { data: bizMax }] = await Promise.all([
            admin.from('staff_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
            admin.from('branch_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
            admin.from('biz_day_metrics').select('metric_date').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
        ]);

        // Количество записей без выставленного rating_score
        const [
            { count: staffNoRating },
            { count: branchesNoRating },
            { count: bizNoRating },
        ] = await Promise.all([
            admin.from('staff').select('id', { count: 'exact', head: true }).or('rating_score.is.null,rating_score.eq.0'),
            admin.from('branches').select('id', { count: 'exact', head: true }).or('rating_score.is.null,rating_score.eq.0'),
            admin.from('businesses').select('id', { count: 'exact', head: true }).or('rating_score.is.null,rating_score.eq.0'),
        ]);

        return createSuccessResponse({
            staff_last_metric_date: staffMax?.metric_date ?? null,
            branch_last_metric_date: branchMax?.metric_date ?? null,
            biz_last_metric_date: bizMax?.metric_date ?? null,
            staff_without_rating: staffNoRating ?? null,
            branches_without_rating: branchesNoRating ?? null,
            businesses_without_rating: bizNoRating ?? null,
        });
    });
}


