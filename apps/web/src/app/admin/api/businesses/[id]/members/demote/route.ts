export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = { user_id?: string };

function isUuid(v?: string | null): v is string {
    return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request, context: { params?: { id?: string } }) {
    try {
        const biz_id = context?.params?.id ?? '';
        if (!isUuid(biz_id)) return NextResponse.json({ok: false, error: 'bad biz_id'}, {status: 400});

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

        // доступ: super_admin глобально ИЛИ owner/admin этого бизнеса
        const {data: superRow} = await supa
            .from('user_roles_with_user')
            .select('user_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        let allowed = !!superRow;
        if (!allowed) {
            const {data: isOwner} = await supa.rpc('has_role', {p_role: 'owner', p_biz_id: biz_id});
            const {data: isAdmin} = await supa.rpc('has_role', {p_role: 'admin', p_biz_id: biz_id});
            allowed = !!isOwner || !!isAdmin;
        }
        if (!allowed) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        const body = (await req.json()) as Body;
        const user_id = body.user_id ?? '';
        if (!isUuid(user_id)) return NextResponse.json({ok: false, error: 'bad user_id'}, {status: 400});

        const admin = createClient(URL, SERVICE);

        // найдём role_id для client
        const {data: clientRole} = await admin.from('roles').select('id').eq('key', 'client').maybeSingle();
        if (!clientRole?.id) return NextResponse.json({ok: false, error: 'client role not found'}, {status: 400});

        // удаляем все роли для этого бизнеса КРОМЕ client
        await admin.from('user_roles')
            .delete()
            .eq('user_id', user_id)
            .eq('biz_id', biz_id)
            .neq('role_id', clientRole.id);

        // гарантируем, что client присутствует
        await admin.from('user_roles').upsert(
            {user_id, biz_id, role_id: clientRole.id},
            {onConflict: 'user_id,biz_id,role_id'}
        );

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
