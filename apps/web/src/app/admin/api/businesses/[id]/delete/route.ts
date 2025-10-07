// apps/web/src/app/admin/api/businesses/[id]/delete/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

export async function POST(_req: Request, {params}: { params: { id: string } }) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        // Клиент с куками пользователя (для auth.uid() в RPC)
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        // Проверим, что пользователь есть и он супер-админ
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // Вызов RPC удаления (внутри — проверка супер-админа ещё раз и каскад)
        const {error} = await supa.rpc('delete_business_cascade', {p_biz_id: params.id});
        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
         
        console.error('delete business error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

// (опционально) поддержка HTTP DELETE:
export const DELETE = POST;
