// apps/web/src/app/admin/api/users/[id]/toggle-super/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = { makeSuper?: boolean };

export async function POST(req: Request, {params}: { params: { id: string } }) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // Проверяем, что вызывающий — глобальный супер-админ
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        const {
            data: {user},
        } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: superRow, error: superErr} = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (superErr) return NextResponse.json({ok: false, error: superErr.message}, {status: 400});
        if (!superRow) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // Работаем админ-клиентом
        const admin = createClient(URL, SERVICE);
        const body = (await req.json()) as Body;
        const makeSuper = !!body.makeSuper;

        // Найдём role_id для super_admin
        const {data: roleRow, error: roleErr} = await admin
            .from('roles')
            .select('id')
            .eq('key', 'super_admin')
            .maybeSingle();

        if (roleErr || !roleRow) {
            return NextResponse.json({ok: false, error: 'Роль super_admin не найдена'}, {status: 400});
        }

        const role_id = roleRow.id;

        if (makeSuper) {
            const {error} = await admin
                .from('user_roles')
                .upsert({user_id: params.id, biz_id: null, role_id}, {onConflict: 'user_id,biz_id,role_id'});
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        } else {
            const {error} = await admin
                .from('user_roles')
                .delete()
                .eq('user_id', params.id)
                .is('biz_id', null)
                .eq('role_id', role_id);
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        }

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
