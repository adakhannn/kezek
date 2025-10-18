// apps/web/src/app/admin/api/businesses/[id]/members/revoke/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request, ctx: { params: { id: string } }) {
    try {
        const biz_id = ctx?.params?.id ?? '';
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        const { data: superRow } = await supa
            .from('user_roles_with_user')
            .select('user_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        let allowed = !!superRow;
        if (!allowed) {
            const { data: isOwner } = await supa.rpc('has_role', { p_role: 'owner', p_biz_id: biz_id });
            const { data: isAdmin } = await supa.rpc('has_role', { p_role: 'admin', p_biz_id: biz_id });
            allowed = !!isOwner || !!isAdmin;
        }
        if (!allowed) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        type Body = { user_id?: string; role_key?: 'owner' | 'admin' | 'manager' | 'staff' | 'client' };
        const body = (await req.json()) as Body;
        const user_id = (body.user_id ?? '').trim();
        const role_key = body.role_key ?? 'client';
        if (!user_id) return NextResponse.json({ ok: false, error: 'bad user_id' }, { status: 400 });

        const admin = createClient(URL, SERVICE);

        const { data: roleRow, error: roleErr } = await admin
            .from('roles')
            .select('id')
            .eq('key', role_key)
            .maybeSingle();
        if (roleErr || !roleRow) {
            return NextResponse.json({ ok: false, error: 'role not found' }, { status: 400 });
        }

        const { error: delErr } = await admin
            .from('user_roles')
            .delete()
            .eq('user_id', user_id)
            .eq('role_id', roleRow.id)
            .eq('biz_id', biz_id);
        if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });

        // если сняли owner — очистим owner_id у бизнеса (если это он)
        if (role_key === 'owner') {
            await admin
                .from('businesses')
                .update({ owner_id: null })
                .eq('id', biz_id)
                .eq('owner_id', user_id);
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
