// apps/web/src/app/api/auth/telegram/link/route.ts
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createErrorResponse, handleApiError } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import {
    TelegramAuthData,
    normalizeTelegramData,
    verifyTelegramAuth,
} from '@/lib/telegram/verify';

/**
 * POST /api/auth/telegram/link
 * Связывает Telegram аккаунт с текущим залогиненным пользователем
 */
export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        // Проверяем авторизацию текущего пользователя
        const supabase = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value,
                set: () => {},
                remove: () => {},
            },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

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

        return NextResponse.json({
            ok: true,
            message: 'Telegram успешно привязан',
        });
    } catch (error) {
        return handleApiError(error, 'TelegramLink', 'Внутренняя ошибка при привязке Telegram');
    }
}

