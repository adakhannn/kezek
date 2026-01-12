// apps/web/src/app/admin/api/roles/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Body = { key: string; name: string; description?: string | null };

export async function POST(req: Request) {
    try {
        const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok:false, error:'auth' }, { status: 401 });

        const { data: superRow, error: roleErr } = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (roleErr || !superRow) {
            return NextResponse.json({ ok:false, error:'forbidden' }, { status: 403 });
        }

        const body = (await req.json()) as Body;
        const key  = (body.key ?? '').trim();
        const name = (body.name ?? '').trim();
        const description = (body.description ?? null) || null;

        if (!/^[a-z0-9_-]{2,32}$/.test(key)) {
            return NextResponse.json({ ok:false, error:'Некорректный ключ роли' }, { status: 400 });
        }
        if (!name) {
            return NextResponse.json({ ok:false, error:'Название обязательно' }, { status: 400 });
        }

        // защитимся от «случайного» создания супер-админа как пользовательской роли
        const is_system = key === 'super_admin';

        const { data: row, error } = await supa
            .from('roles')
            .insert({ key, name, description, is_system })
            .select('id')
            .maybeSingle();

        if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 400 });

        return NextResponse.json({ ok:true, id: row?.id });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok:false, error: msg }, { status: 500 });
    }
}
