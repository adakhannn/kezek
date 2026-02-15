// apps/web/src/app/api/reviews/update/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

type Body = { review_id: string; rating: number; comment?: string };

export async function POST(req: Request) {
    return withErrorHandler('ReviewsUpdate', async () => {
        const body = (await req.json()) as Body;
        if (!body.review_id || !body.rating) {
            return createErrorResponse('validation', 'review_id и rating обязательны', undefined, 400);
        }

        // Используем унифицированную утилиту для создания Supabase клиента
        const supabase = await createSupabaseServerClient();

        // Получаем текущего пользователя
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const userId = auth.user.id;

        // Проверяем, что отзыв существует и принадлежит текущему пользователю
        const { data: review, error: reviewError } = await supabase
            .from('reviews')
            .select('id, client_id, booking_id')
            .eq('id', body.review_id)
            .maybeSingle();

        if (reviewError || !review) {
            return createErrorResponse('not_found', 'Отзыв не найден', undefined, 404);
        }

        if (review.client_id !== userId) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        // Обновляем отзыв
        const {error, data} = await supabase
            .from('reviews')
            .update({
                rating: body.rating,
                comment: body.comment ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', body.review_id)
            .select('id')
            .single();

        if (error) {
            return createErrorResponse('validation', error.message, undefined, 400);
        }

        return createSuccessResponse({ id: data?.id });
    });
}

