/**
 * Общая логика создания пользователя
 * Используется как в API route, так и в Server Actions
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { isEmail, isE164 } from '@/lib/validation';

export type CreateUserPayload = {
    email?: string | null;
    phone?: string | null;
    full_name?: string | null;
    password?: string | null;
};

export type CreateUserResult =
    | { ok: true; id: string; method: 'email_password' | 'phone_otp' }
    | { ok: false; error: string; status: number };

function normStr(v?: string | null): string | null {
    const s = (v ?? '').trim();
    return s.length ? s : null;
}

/**
 * Создаёт пользователя с проверкой прав доступа
 */
export async function createUser(payload: CreateUserPayload): Promise<CreateUserResult> {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        // Проверка: только глобальный super_admin
        const cookieStore = await cookies();
        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: me } = await supa.auth.getUser();
        if (!me.user) return { ok: false, error: 'auth', status: 401 };

        const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
        if (eSuper) return { ok: false, error: eSuper.message, status: 400 };
        if (!isSuper) return { ok: false, error: 'forbidden', status: 403 };

        const email = normStr(payload.email);
        const phone = normStr(payload.phone);
        const full_name = normStr(payload.full_name);
        const password = normStr(payload.password);

        if (!email && !phone) {
            return { ok: false, error: 'Нужен email или телефон', status: 400 };
        }
        if (email && !isEmail(email)) {
            return { ok: false, error: 'Некорректный email', status: 400 };
        }
        if (phone && !isE164(phone)) {
            return { ok: false, error: 'Телефон должен быть в формате E.164 (например, +996...)', status: 400 };
        }

        // Правило 1: если есть email → пароль обязателен
        if (email) {
            if (!password || password.length < 8) {
                return { ok: false, error: 'Для email требуется пароль (минимум 8 символов)', status: 400 };
            }
        }

        // Правило 2: если только телефон → пароль не должен передаваться
        if (!email && phone && password) {
            return { ok: false, error: 'Для регистрации по телефону пароль не нужен (вход через OTP)', status: 400 };
        }

        const admin = createClient(URL, SERVICE);

        // Хелпер: апсерт профиля
        async function upsertProfile(userId?: string | null) {
            if (userId && full_name) {
                await admin.from('profiles').upsert({ id: userId, full_name }, { onConflict: 'id' });
            }
        }

        // === ВЕТКА A: email (+ опционально phone), пароль обязателен ===
        if (email) {
            const { data: created, error: createErr } = await admin.auth.admin.createUser({
                email,
                email_confirm: true,
                phone: phone ?? undefined,
                phone_confirm: phone ? true : undefined,
                password: password!,
                user_metadata: full_name ? { full_name } : {},
            });

            if (createErr) {
                const msg = /already registered/i.test(createErr.message)
                    ? 'Пользователь уже существует'
                    : createErr.message;
                return { ok: false, error: msg, status: 409 };
            }

            const uid = created?.user?.id ?? null;
            if (!uid) return { ok: false, error: 'Failed to create user', status: 500 };
            await upsertProfile(uid);

            return { ok: true, id: uid, method: 'email_password' as const };
        }

        // === ВЕТКА B: только телефон, без пароля → вход через OTP ===
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
            phone: phone!,
            phone_confirm: true,
            user_metadata: full_name ? { full_name } : {},
        });

        if (createErr) {
            const msg = /already registered/i.test(createErr.message)
                ? 'Пользователь уже существует'
                : createErr.message;
            return { ok: false, error: msg, status: 409 };
        }

        const uid = created?.user?.id ?? null;
        if (!uid) return { ok: false, error: 'Failed to create user', status: 500 };
        await upsertProfile(uid);

        return { ok: true, id: uid, method: 'phone_otp' as const };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg, status: 500 };
    }
}

