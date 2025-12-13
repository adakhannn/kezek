// apps/web/src/app/admin/api/businesses/[id]/delete/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import { getRouteParamRequired } from '@/lib/routeParams';

export async function POST(_req: Request, context: unknown) {
    try {
        const bizId = await getRouteParamRequired(context, 'id');

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // проверяем, что вызывает супер-админ
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // сервис-клиент и RPC
        const admin = createClient(URL, SERVICE);
        const {error: delErr} = await admin.rpc('force_delete_business_and_downgrade_owner', {
            p_biz_id: bizId,
        });
        if (delErr) {
            return NextResponse.json({ok: false, error: delErr.message}, {status: 400});
        }

        return NextResponse.json({ok: true});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

