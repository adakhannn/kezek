export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Body = { makeSuper?: boolean };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // Проверяем, что вызвавший — глобальный супер-админ
        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supa.auth.getUser();
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

        const admin = createClient(URL, SERVICE);
        const body = (await req.json()) as Body;
        const makeSuper = !!body.makeSuper;

        // находим role_id супер-админа
        const { data: roleRow, error: roleErr } = await admin
            .from('roles')
            .select('id')
            .eq('key', 'super_admin')
            .maybeSingle();

        if (roleErr || !roleRow) {
            return NextResponse.json({ ok: false, error: 'Роль super_admin не найдена' }, { status: 400 });
        }

        const role_id = roleRow.id;

        if (makeSuper) {
            // проверка существования
            const { data: existing, error: exErr } = await admin
                .from('user_roles')
                .select('user_id')
                .eq('user_id', id)
                .eq('role_id', role_id)
                .is('biz_id', null)
                .limit(1)
                .maybeSingle();
            if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 400 });

            if (!existing) {
                const { error: insErr } = await admin
                    .from('user_roles')
                    .insert({ user_id: id, role_id, biz_id: null });
                if (insErr && (insErr).code !== '23505') {
                    return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
                }
            }
        } else {
            const { error: delErr } = await admin
                .from('user_roles')
                .delete()
                .eq('user_id', id)
                .eq('role_id', role_id)
                .is('biz_id', null);
            if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
