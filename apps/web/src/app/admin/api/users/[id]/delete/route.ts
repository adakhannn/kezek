// apps/web/src/app/admin/api/users/[id]/delete/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, context: unknown) {
    try {
        // безопасно извлекаем params.id
        const params =
            typeof context === 'object' && context !== null && 'params' in context
                ? (context as { params?: Record<string, string | string[]> }).params ?? {}
                : {};
        const id = Array.isArray(params.id) ? params.id[0] : params.id;
        if (!id) {
            return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 });
        }

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // Проверяем, что вызывающий — глобальный супер-админ
        const supa = createServerClient(URL, ANON, {
            cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const {
            data: { user },
        } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        const { data: superRow, error: superErr } = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (superErr) return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        if (!superRow) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        // Админ-клиент для административных операций
        const admin = createClient(URL, SERVICE);

        // Нельзя удалить пользователя, который сам является глобальным супер-админом
        const { data: victimSuper } = await admin
            .from('user_roles_with_user')
            .select('user_id')
            .eq('user_id', id)
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (victimSuper) {
            return NextResponse.json(
                { ok: false, error: 'Нельзя удалить глобального супер-админа' },
                { status: 400 },
            );
        }

        // Чистим роли (необязательно, но аккуратно)
        await admin.from('user_roles').delete().eq('user_id', id);

        // Удаляем пользователя через Admin API
        const { error: delErr } = await admin.auth.admin.deleteUser(id);
        if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

// На всякий — поддержим DELETE тем же кодом
export const DELETE = POST;
