// apps/web/src/app/api/reviews/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

type Body = { booking_id: string; rating: number; comment?: string };

export async function POST(req: Request) {
    return withErrorHandler('ReviewsCreate', async () => {
        const body = (await req.json()) as Body;
        if (!body.booking_id || !body.rating) {
            return createErrorResponse('validation', 'booking_id и rating обязательны', undefined, 400);
        }

        // Используем унифицированную утилиту для создания Supabase клиента
        const supabase = await createSupabaseServerClient();

        // Получаем текущего пользователя
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const userId = auth.user.id;

        // Проверяем, что запись принадлежит текущему пользователю
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id, client_id, status')
            .eq('id', body.booking_id)
            .maybeSingle();

        if (bookingError || !booking) {
            return createErrorResponse('not_found', 'Бронирование не найдено', undefined, 404);
        }

        // Проверяем, что запись принадлежит текущему пользователю
        if (booking.client_id !== userId) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        // Проверяем, что отзыв еще не существует
        const { data: existingReview } = await supabase
            .from('reviews')
            .select('id, client_id')
            .eq('booking_id', body.booking_id)
            .maybeSingle();

        if (existingReview) {
            // Если отзыв существует и принадлежит текущему пользователю, обновляем его
            if (existingReview.client_id === userId) {
                const {error, data} = await supabase
                    .from('reviews')
                    .update({
                        rating: body.rating,
                        comment: body.comment ?? null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existingReview.id)
                    .select('id')
                    .single();

                if (error) {
                    return createErrorResponse('validation', error.message, undefined, 400);
                }

                return createSuccessResponse({ id: data?.id, updated: true });
            } else {
                // Отзыв существует, но принадлежит другому пользователю
                return createErrorResponse('conflict', 'Отзыв уже существует', undefined, 409);
            }
        }

        // Создаем новый отзыв с client_id
        const {error, data} = await supabase
            .from('reviews')
            .insert({
                booking_id: body.booking_id,
                client_id: userId,
                rating: body.rating,
                comment: body.comment ?? null,
            })
            .select('id')
            .single();

        if (error) {
            return createErrorResponse('validation', error.message, undefined, 400);
        }

        return createSuccessResponse({ id: data?.id, updated: false });
    });
}
