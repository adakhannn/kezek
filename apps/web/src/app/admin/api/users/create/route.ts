// apps/web/src/app/admin/api/users/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';


type Body = {
    email?: string | null;
    phone?: string | null;
    full_name?: string | null;
    password?: string | null;
};

function normStr(v?: string | null): string | null {
    const s = (v ?? '').trim();
    return s.length ? s : null;
}

function isEmail(s: string): boolean {
    // простая проверка; SMTP всё равно финально валидирует
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isE164Phone(s: string): boolean {
    // +996..., до 15 цифр по E.164
    return /^\+[1-9]\d{1,14}$/.test(s);
}

export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        const cookieStore = await cookies(); // без await
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        // доступ только супер-админу
        const {
            data: {user: me},
        } = await supa.auth.getUser();
        if (!me) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // читаем и валидируем тело
        const raw = (await req.json()) as Body;
        const email = normStr(raw.email);
        const phone = normStr(raw.phone);
        const full_name = normStr(raw.full_name);
        const providedPwd = normStr(raw.password);

        if (!email && !phone) {
            return NextResponse.json({ok: false, error: 'Нужен email или телефон'}, {status: 400});
        }
        if (email && !isEmail(email)) {
            return NextResponse.json({ok: false, error: 'Некорректный email'}, {status: 400});
        }
        if (phone && !isE164Phone(phone)) {
            return NextResponse.json({
                ok: false,
                error: 'Телефон должен быть в формате E.164 (например, +996... )'
            }, {status: 400});
        }
        if (providedPwd && providedPwd.length < 8) {
            return NextResponse.json({ok: false, error: 'Пароль минимум 8 символов'}, {status: 400});
        }

        const password =
            providedPwd && providedPwd.length >= 8 ? providedPwd : crypto.randomBytes(10).toString('hex');

        const admin = createClient(URL, SERVICE);

        // создаём пользователя через Admin API
        const {data: created, error: createErr} = await admin.auth.admin.createUser({
            email: email ?? undefined,
            phone: phone ?? undefined,
            password,
            email_confirm: !!email,
            phone_confirm: !!phone,
            user_metadata: {full_name: full_name ?? undefined},
        });

        if (createErr) {
            const msg = /already registered/i.test(createErr.message)
                ? 'Пользователь уже существует'
                : createErr.message;
            // 409 — конфликт
            return NextResponse.json({ok: false, error: msg}, {status: 409});
        }

        const newUserId = created?.user?.id ?? null;

        // продублируем имя в profiles (если указано)
        if (newUserId && full_name) {
            const {error: profErr} = await admin
                .from('profiles')
                .upsert({id: newUserId, full_name}, {onConflict: 'id'});
            if (profErr) {
                // не фейлим весь запрос: просто сообщим, что профиль не обновился
                return NextResponse.json({
                    ok: true,
                    id: newUserId,
                    passwordIssued: !providedPwd,
                    warn: `Пользователь создан, но не удалось сохранить full_name: ${profErr.message}`,
                });
            }
        }

        return NextResponse.json({
            ok: true,
            id: newUserId,
            passwordIssued: !providedPwd, // true — если пароль был сгенерен
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('user create error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

