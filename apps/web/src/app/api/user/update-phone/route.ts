import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 });
        }

        const body = await req.json();
        const phone = typeof body.phone === 'string' ? body.phone.trim() : null;

        if (!phone) {
            return NextResponse.json({ ok: false, error: 'Телефон обязателен' }, { status: 400 });
        }

        // Проверяем формат E.164
        if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
            return NextResponse.json({ ok: false, error: 'Некорректный формат телефона' }, { status: 400 });
        }

        const admin = createClient(URL, SERVICE);

        // Обновляем телефон пользователя
        const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
            phone,
            phone_confirm: false, // Пользователь должен подтвердить телефон через OTP
        });

        if (updateError) {
            return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

