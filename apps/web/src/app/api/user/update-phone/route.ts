import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    // Применяем rate limiting для смены номера телефона (безопасность)
    return withRateLimit(
        req,
        RateLimitConfigs.auth,
        () => withErrorHandler('UserUpdatePhone', async () => {
        // Используем унифицированные утилиты для создания клиентов
        const { supabase, admin } = await createSupabaseClients();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const body = await req.json();
        const phone = typeof body.phone === 'string' ? body.phone.trim() : null;

        if (!phone) {
            return createErrorResponse('validation', 'Телефон обязателен', undefined, 400);
        }

        // Проверяем формат E.164
        if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
            return createErrorResponse('validation', 'Некорректный формат телефона', undefined, 400);
        }

        // Обновляем телефон пользователя
        const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
            phone,
            phone_confirm: false, // Пользователь должен подтвердить телефон через OTP
        });

        if (updateError) {
            return createErrorResponse('validation', updateError.message, undefined, 400);
        }

        return createSuccessResponse();
        })
    );
}

