import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/ratings/jobs
 * Список задач пересчёта рейтингов (rating_jobs) для админки.
 * Доступно только суперадминам.
 */
export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () =>
            withErrorHandler('RatingsJobs', async () => {
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

                const admin = getServiceClient();

                const { data, error } = await admin
                    .from('rating_jobs')
                    .select('id, created_at, started_at, finished_at, created_by, date_from, date_to, scope, status, processed_days, total_days, error_summary, error_message')
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) {
                    return createErrorResponse('internal', error.message, undefined, 500);
                }

                return createSuccessResponse({
                    jobs: data ?? [],
                });
            }),
    );
}

