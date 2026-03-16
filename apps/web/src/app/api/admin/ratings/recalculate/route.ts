import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RecalcBody = {
    entity_type: 'staff' | 'branch' | 'biz';
    entity_id: string;
    date_from?: string | null;
    date_to?: string | null;
};

export async function POST(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.critical,
        () =>
            withErrorHandler('RatingsManualRecalculate', async () => {
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

                const body = (await req.json().catch(() => ({}))) as RecalcBody;
                const { entity_type, entity_id, date_from, date_to } = body;

                if (!entity_type || !entity_id) {
                    return createErrorResponse('bad_request', 'entity_type и entity_id обязательны', undefined, 400);
                }

                const admin = getServiceClient();

                const parsedDateFrom = date_from ? new Date(date_from) : null;
                const parsedDateTo = date_to ? new Date(date_to) : null;

                const action: 'recalculate_metrics' | 'recalculate_rating' =
                    parsedDateFrom && parsedDateTo ? 'recalculate_metrics' : 'recalculate_rating';

                let status: 'success' | 'error' = 'success';
                let errorMessage: string | null = null;

                try {
                    if (action === 'recalculate_metrics') {
                        const startDate = parsedDateFrom!.toISOString().slice(0, 10);
                        const endDate = parsedDateTo!.toISOString().slice(0, 10);

                        if (entity_type === 'staff') {
                            await admin.rpc('recalculate_ratings_for_date_range', {
                                p_start_date: startDate,
                                p_end_date: endDate,
                            });
                            await admin.rpc('calculate_staff_rating', { p_staff_id: entity_id });
                        } else if (entity_type === 'branch') {
                            await admin.rpc('recalculate_ratings_for_date_range', {
                                p_start_date: startDate,
                                p_end_date: endDate,
                            });
                            await admin.rpc('calculate_branch_rating', { p_branch_id: entity_id });
                        } else if (entity_type === 'biz') {
                            await admin.rpc('recalculate_ratings_for_date_range', {
                                p_start_date: startDate,
                                p_end_date: endDate,
                            });
                            await admin.rpc('calculate_biz_rating', { p_biz_id: entity_id });
                        }
                    } else {
                        if (entity_type === 'staff') {
                            await admin.rpc('calculate_staff_rating', { p_staff_id: entity_id });
                        } else if (entity_type === 'branch') {
                            await admin.rpc('calculate_branch_rating', { p_branch_id: entity_id });
                        } else if (entity_type === 'biz') {
                            await admin.rpc('calculate_biz_rating', { p_biz_id: entity_id });
                        }
                    }
                } catch (e) {
                    status = 'error';
                    errorMessage = e instanceof Error ? e.message : String(e);
                }

                // Логируем ручной перезапуск (best-effort, не ломаем ответ при ошибке)
                try {
                    await admin.from('rating_manual_recalc_log').insert({
                        user_id: user.id,
                        entity_type,
                        entity_id,
                        date_from: parsedDateFrom ? parsedDateFrom.toISOString().slice(0, 10) : null,
                        date_to: parsedDateTo ? parsedDateTo.toISOString().slice(0, 10) : null,
                        action,
                        status,
                        error_message: errorMessage,
                    });
                } catch {
                    // ignore
                }

                if (status === 'error') {
                    return createErrorResponse('internal', errorMessage || 'Ошибка пересчёта рейтинга', undefined, 500);
                }

                return createSuccessResponse({
                    ok: true,
                    entity_type,
                    entity_id,
                    action,
                });
            }),
    );
}

