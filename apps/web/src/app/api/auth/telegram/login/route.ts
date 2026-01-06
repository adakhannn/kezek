// apps/web/src/app/api/auth/telegram/login/route.ts
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

        // Пытаемся найти профиль по telegram_id
        const { data: existingProfile, error: profileSelectError } = await admin
            .from('profiles')
            .select('id, telegram_id')
            .eq('telegram_id', normalized.telegram_id)
            .maybeSingle<{ id: string | null; telegram_id: number | null }>();

        if (profileSelectError) {
            console.error('[telegram/login] profile select error:', profileSelectError);
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
                console.error('[telegram/login] profile update error:', profileUpdateError);
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
                console.error('[telegram/login] auth createUser error:', authError);
                return NextResponse.json(
                    {
                        ok: false,
                        error: 'auth_error',
                        message: authError?.message ?? 'Ошибка создания пользователя',
                    },
                    { status: 500 },
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
                console.error('[telegram/login] profile insert error:', profileInsertError);
                // Не критично – профиль можно создать позже
            }
        }

        // Создаём временный пароль для входа (аналогично WhatsApp flow)
        const tempPassword = crypto.randomBytes(16).toString('hex');
        const tempEmail = `telegram_${normalized.telegram_id}@telegram.local`;

        const { data: currentUser, error: getUserError } = await admin.auth.admin.getUserById(userId);
        if (getUserError) {
            console.error('[telegram/login] getUserById error:', getUserError);
        }

        // Если у пользователя нет email – задаём временный
        if (!currentUser?.user?.email) {
            const { error: updateEmailError } = await admin.auth.admin.updateUserById(userId, {
                email: tempEmail,
                email_confirm: true,
            });

            if (updateEmailError) {
                console.error('[telegram/login] update email error:', updateEmailError);
            }
        }

        const emailToUse = currentUser?.user?.email ?? tempEmail;

        // Устанавливаем временный пароль, который клиент использует для входа
        const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
            password: tempPassword,
        });

        if (passwordError) {
            console.error('[telegram/login] set password error:', passwordError);
            return NextResponse.json(
                { ok: false, error: 'session_error', message: 'Не удалось подготовить сессию' },
                { status: 500 },
            );
        }

        return NextResponse.json({
            ok: true,
            userId,
            email: emailToUse,
            password: tempPassword,
            needsSignIn: true,
            redirect: '/',
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[telegram/login] error:', e);
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


