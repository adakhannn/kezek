// apps/web/src/app/admin/api/categories/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

export async function GET() {
    const URL = getSupabaseUrl();
    const ANON = getSupabaseAnonKey();
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: {
            get: (n: string) => cookieStore.get(n)?.value, set: () => {
            }, remove: () => {
            }
        },
    });

    const {data: {user}} = await supa.auth.getUser();
    if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});
    const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
    if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
    if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

    // берём из RPC с usage_count
    const {data, error} = await supa.rpc('categories_with_usage_v2');
    if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
    return NextResponse.json({ok: true, items: data ?? []});
}
