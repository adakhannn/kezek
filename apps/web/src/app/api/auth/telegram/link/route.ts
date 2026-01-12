// apps/web/src/app/api/auth/telegram/link/route.ts
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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
            return NextResponse.json(
                { ok: false, error: 'auth', message: 'Не авторизован' },
                { status: 401 },
            );
        }

        const body = (await req.json()) as TelegramAuthData;

        if (!body || !body.id || !body.hash || !body.auth_date) {
            return NextResponse.json(
                { ok: false, error: 'missing_data', message: 'Недостаточно данных от Telegram' },
                { status: 400 },
            );
        }

        // Проверяем подпись
        if (!verifyTelegramAuth(body)) {
            return NextResponse.json(
                { ok: false, error: 'invalid_signature', message: 'Неверная подпись данных Telegram' },
                { status: 400 },
            );
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
            return NextResponse.json(
                {
                    ok: false,
                    error: 'already_linked',
                    message: 'Этот Telegram аккаунт уже привязан к другому пользователю',
                },
                { status: 400 },
            );
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
            console.error('[telegram/link] profile update error:', profileUpdateError);
            return NextResponse.json(
                {
                    ok: false,
                    error: 'update_error',
                    message: profileUpdateError.message || 'Не удалось привязать Telegram',
                },
                { status: 500 },
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
            console.error('[telegram/link] metadata update error:', metaError);
            // Не критично, продолжаем
        }

        return NextResponse.json({
            ok: true,
            message: 'Telegram успешно привязан',
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[telegram/link] error:', e);
        return NextResponse.json(
            {
                ok: false,
                error: 'internal',
                message: msg,
            },
            { status: 500 },
        );
    }
}

