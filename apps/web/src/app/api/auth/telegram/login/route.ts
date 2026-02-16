// apps/web/src/app/api/auth/telegram/login/route.ts
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import { createClient } from '@supabase/supabase-js';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import {
    TelegramAuthData,
    normalizeTelegramData,
    verifyTelegramAuth,
} from '@/lib/telegram/verify';

/**
 * POST /api/auth/telegram/login
 * Обрабатывает данные от Telegram Login Widget, создаёт/находит пользователя
 * и возвращает данные для входа (email + временный пароль), если нужно.
 */
export async function POST(req: Request) {
    // Применяем rate limiting для аутентификации
    return withRateLimit(
        req,
        RateLimitConfigs.auth,
        async () => {
            return withErrorHandler('TelegramLogin', async () => {
                const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
                const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        const body = (await req.json()) as TelegramAuthData;

        if (!body || !body.id || !body.hash || !body.auth_date) {
            return createErrorResponse('validation', 'Недостаточно данных от Telegram', { code: 'missing_data' }, 400);
        }

        // Проверяем подпись
        if (!verifyTelegramAuth(body)) {
            return createErrorResponse('validation', 'Неверная подпись данных Telegram', { code: 'invalid_signature' }, 400);
        }

        const admin = createClient(URL, SERVICE);
        const normalized = normalizeTelegramData(body);

        // Пытаемся найти профиль по telegram_id
        const { data: existingProfile, error: profileSelectError } = await admin
            .from('profiles')
            .select('id, telegram_id')
            .eq('telegram_id', normalized.telegram_id)
            .maybeSingle<{ id: string | null; telegram_id: number | null }>();

        if (profileSelectError) {
            logError('TelegramLogin', 'Profile select error', profileSelectError);
        }

        let userId: string;

        if (existingProfile?.id) {
            // Пользователь уже существует – обновляем профиль
            userId = existingProfile.id;

            const { error: profileUpdateError } = await admin
                .from('profiles')
                .update({
                    full_name: normalized.full_name,
                    telegram_username: normalized.telegram_username,
                    telegram_photo_url: normalized.telegram_photo_url,
                    telegram_verified: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);

            if (profileUpdateError) {
                logError('TelegramLogin', 'Profile update error', profileUpdateError);
            }
        } else {
            // Новый пользователь – создаём в Supabase Auth и в profiles
            const tempEmail = `telegram_${normalized.telegram_id}@telegram.local`;
            const initialPassword = crypto.randomBytes(32).toString('hex');

            const { data: authUser, error: authError } = await admin.auth.admin.createUser({
                email: tempEmail,
                password: initialPassword,
                email_confirm: true,
                user_metadata: {
                    telegram_id: normalized.telegram_id,
                    telegram_username: normalized.telegram_username,
                    auth_provider: 'telegram',
                },
            });

            if (authError || !authUser?.user) {
                logError('TelegramLogin', 'Auth createUser error', authError);
                return createErrorResponse(
                    'internal',
                    authError?.message ?? 'Ошибка создания пользователя',
                    { code: 'auth_error' },
                    500
                );
            }

            userId = authUser.user.id;

            const { error: profileInsertError } = await admin.from('profiles').insert({
                id: userId,
                full_name: normalized.full_name,
                telegram_id: normalized.telegram_id,
                telegram_username: normalized.telegram_username,
                telegram_photo_url: normalized.telegram_photo_url,
                telegram_verified: true,
            });

            if (profileInsertError) {
                logError('TelegramLogin', 'Profile insert error', profileInsertError);
                // Не критично – профиль можно создать позже
            }
        }

        // Создаём временный пароль для входа (аналогично WhatsApp flow)
        const tempPassword = crypto.randomBytes(16).toString('hex');
        const tempEmail = `telegram_${normalized.telegram_id}@telegram.local`;

        const { data: currentUser, error: getUserError } = await admin.auth.admin.getUserById(userId);
        if (getUserError) {
            logError('TelegramLogin', 'GetUserById error', getUserError);
        }

        // Если у пользователя нет email – задаём временный
        if (!currentUser?.user?.email) {
            const { error: updateEmailError } = await admin.auth.admin.updateUserById(userId, {
                email: tempEmail,
                email_confirm: true,
            });

            if (updateEmailError) {
                logError('TelegramLogin', 'Update email error', updateEmailError);
            }
        }

        const emailToUse = currentUser?.user?.email ?? tempEmail;

        // Устанавливаем временный пароль, который клиент использует для входа
        const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
            password: tempPassword,
        });

        if (passwordError) {
            logError('TelegramLogin', 'Set password error', passwordError);
            return createErrorResponse('internal', 'Не удалось подготовить сессию', { code: 'session_error' }, 500);
        }

        return createSuccessResponse({
            userId,
            email: emailToUse,
            password: tempPassword,
            needsSignIn: true,
            redirect: '/',
        });
            });
        }
    );
}


