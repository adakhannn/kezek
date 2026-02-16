// apps/web/src/app/api/auth/telegram/link/route.ts
export const dynamic = 'force-dynamic';


import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseClients } from '@/lib/supabaseHelpers';
import {
    TelegramAuthData,
    normalizeTelegramData,
    verifyTelegramAuth,
} from '@/lib/telegram/verify';
import { validateRequest } from '@/lib/validation/apiValidation';
import { telegramAuthDataSchema } from '@/lib/validation/schemas';

/**
 * POST /api/auth/telegram/link
 * Связывает Telegram аккаунт с текущим залогиненным пользователем
 */
export async function POST(req: Request) {
    // Применяем rate limiting для аутентификации
    return withRateLimit(
        req,
        RateLimitConfigs.auth,
        async () => {
            return withErrorHandler('TelegramLink', async () => {
                // Используем унифицированные утилиты для создания клиентов
                const { supabase, admin } = await createSupabaseClients();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        // Валидация запроса
        const validationResult = await validateRequest(req, telegramAuthDataSchema);
        if (!validationResult.success) {
            return validationResult.response;
        }
        const body = validationResult.data as TelegramAuthData;

        // Проверяем подпись
        if (!verifyTelegramAuth(body)) {
            return createErrorResponse('validation', 'Неверная подпись данных Telegram', { code: 'invalid_signature' }, 400);
        }

        const normalized = normalizeTelegramData(body);

        // Проверяем, не привязан ли этот Telegram ID к другому пользователю
        const { data: existingProfile } = await admin
            .from('profiles')
            .select('id, telegram_id')
            .eq('telegram_id', normalized.telegram_id)
            .maybeSingle<{ id: string | null; telegram_id: number | null }>();

        if (existingProfile && existingProfile.id !== user.id) {
            return createErrorResponse('conflict', 'Этот Telegram аккаунт уже привязан к другому пользователю', { code: 'already_linked' }, 400);
        }

        // Обновляем профиль текущего пользователя
        const { error: profileUpdateError } = await admin
            .from('profiles')
            .update({
                telegram_id: normalized.telegram_id,
                telegram_username: normalized.telegram_username,
                telegram_photo_url: normalized.telegram_photo_url,
                telegram_verified: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        if (profileUpdateError) {
            logError('TelegramLink', 'Profile update error', profileUpdateError);
            return createErrorResponse(
                'internal',
                profileUpdateError.message || 'Не удалось привязать Telegram',
                { code: 'update_error' },
                500
            );
        }

        // Также обновляем user_metadata для совместимости
        const prevMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
            user_metadata: {
                ...prevMeta,
                telegram_id: normalized.telegram_id,
                telegram_username: normalized.telegram_username,
            },
        });

        if (metaError) {
            logError('TelegramLink', 'Metadata update error', metaError);
            // Не критично, продолжаем
        }

                return createSuccessResponse({ message: 'Telegram успешно привязан' });
            });
        }
    );
}

