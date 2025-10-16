// apps/web/src/app/admin/api/roles/set-many/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import type { Role } from '@/types/roles';

type Body = { user_id: string; biz_id: string; roles: Role[] };

export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: n => cookieStore.get(n)?.value, set:()=>{}, remove:()=>{} },
        });
        const { data:{ user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok:false, error:'auth' }, { status: 401 });
        const { data:isSuper, error:eSuper } = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ ok:false, error:eSuper.message }, { status: 400 });
        if (!isSuper) return NextResponse.json({ ok:false, error:'forbidden' }, { status: 403 });

        const body = (await req.json()) as Body;
        const allowed: Role[] = ['owner','manager','staff','admin','client'];
        if (!body.user_id || !body.biz_id) return NextResponse.json({ ok:false, error:'user_id & biz_id required' }, { status: 400 });
        if (!Array.isArray(body.roles) || body.roles.some(r => !allowed.includes(r)))
            return NextResponse.json({ ok:false, error:'invalid roles' }, { status: 400 });

        const admin = createClient(URL, SERVICE);

        // удаляем все роли пользователя в этом бизнесе
        const del = await admin.from('user_roles')
            .delete()
            .eq('user_id', body.user_id)
            .eq('biz_id', body.biz_id);
        if (del.error) return NextResponse.json({ ok:false, error: del.error.message }, { status: 400 });

        // добавляем новые
        const rows = body.roles.map(r => ({ user_id: body.user_id, biz_id: body.biz_id, role: r as Role }));
        if (rows.length) {
            const ins = await admin.from('user_roles').insert(rows);
            if (ins.error) return NextResponse.json({ ok:false, error: ins.error.message }, { status: 400 });
        }

        return NextResponse.json({ ok:true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok:false, error: msg }, { status: 500 });
    }
}
