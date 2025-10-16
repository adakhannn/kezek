// apps/web/src/app/admin/api/roles/add/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import type {Role, RoleUpsert} from '@/types/roles';

export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: n => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});
        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        const body = (await req.json()) as RoleUpsert;
        if (!body.user_id || !body.biz_id) return NextResponse.json({
            ok: false,
            error: 'user_id & biz_id required'
        }, {status: 400});
        if (!(['owner', 'manager', 'staff', 'admin', 'client'] as Role[]).includes(body.role))
            return NextResponse.json({ok: false, error: 'invalid role'}, {status: 400});

        const admin = createClient(URL, SERVICE);

        // проверим наличие юзера/бизнеса
        const [u, b] = await Promise.all([
            admin.from('profiles').select('id').eq('id', body.user_id).maybeSingle(),
            admin.from('businesses').select('id').eq('id', body.biz_id).maybeSingle(),
        ]);
        if (!u.data) return NextResponse.json({ok: false, error: 'user not found'}, {status: 400});
        if (!b.data) return NextResponse.json({ok: false, error: 'business not found'}, {status: 400});

        const {error} = await admin.from('user_roles')
            .upsert(body, {onConflict: 'biz_id,user_id,role'});

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
