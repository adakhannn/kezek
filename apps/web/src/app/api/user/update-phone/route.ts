import { NextResponse } from 'next/server';

import { createSupabaseClients } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        // Используем унифицированные утилиты для создания клиентов
        const { supabase, admin } = await createSupabaseClients();

        const { data: { user } } = await supabase.auth.getUser();
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

