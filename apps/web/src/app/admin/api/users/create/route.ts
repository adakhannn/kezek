export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Body = {
    email?: string | null;
    phone?: string | null;
    full_name?: string | null;
    password?: string | null; // обязателен, если есть email
};

function normStr(v?: string | null): string | null {
    const s = (v ?? '').trim();
    return s.length ? s : null;
}

import { isEmail, isE164 } from '@/lib/validation';

export async function POST(req: Request) {
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
        if (!me.user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ ok: false, error: eSuper.message }, { status: 400 });
        if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        // Тело запроса
        const raw = (await req.json().catch(() => ({}))) as Body;
        const email = normStr(raw.email);
        const phone = normStr(raw.phone);
        const full_name = normStr(raw.full_name);
        const password = normStr(raw.password);

        if (!email && !phone) {
            return NextResponse.json({ ok: false, error: 'Нужен email или телефон' }, { status: 400 });
        }
        if (email && !isEmail(email)) {
            return NextResponse.json({ ok: false, error: 'Некорректный email' }, { status: 400 });
        }
        if (phone && !isE164(phone)) {
            return NextResponse.json(
                { ok: false, error: 'Телефон должен быть в формате E.164 (например, +996...)' },
                { status: 400 },
            );
        }

        // Правило 1: если есть email → пароль обязателен
        if (email) {
            if (!password || password.length < 8) {
                return NextResponse.json(
                    { ok: false, error: 'Для email требуется пароль (минимум 8 символов)' },
                    { status: 400 },
                );
            }
        }

        // Правило 2: если только телефон → пароль не должен передаваться
        if (!email && phone && password) {
            return NextResponse.json(
                { ok: false, error: 'Для регистрации по телефону пароль не нужен (вход через OTP)' },
                { status: 400 },
            );
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
                email_confirm: true, // подтверждаем, чтобы обойти рассылку писем
                phone: phone ?? undefined,
                phone_confirm: phone ? true : undefined,
                password: password!, // уже провалидирован
                user_metadata: full_name ? { full_name } : {},
            });

            if (createErr) {
                const msg = /already registered/i.test(createErr.message)
                    ? 'Пользователь уже существует'
                    : createErr.message;
                return NextResponse.json({ ok: false, error: msg }, { status: 409 });
            }

            const uid = created?.user?.id ?? null;
            await upsertProfile(uid);

            return NextResponse.json({ ok: true, id: uid, method: 'email_password' });
        }

        // === ВЕТКА B: только телефон, без пароля → вход через OTP ===
        // (у тебя провайдер OTP уже настроен)
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
            phone: phone!, // тут точно есть
            phone_confirm: true,
            // без password
            user_metadata: full_name ? { full_name } : {},
        });

        if (createErr) {
            const msg = /already registered/i.test(createErr.message)
                ? 'Пользователь уже существует'
                : createErr.message;
            return NextResponse.json({ ok: false, error: msg }, { status: 409 });
        }

        const uid = created?.user?.id ?? null;
        await upsertProfile(uid);

        return NextResponse.json({ ok: true, id: uid, method: 'phone_otp' });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('user create error', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
