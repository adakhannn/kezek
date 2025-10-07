// apps/web/src/app/admin/api/categories/suggest/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type BizCategoriesRow = { categories: string[] | null };

export async function GET() {
    try {
        // проверяем, что вызвал супер-админ
        const cookieStore = await cookies(); // без await
        const supabase = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        const {
            data: {user},
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supabase.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // собираем уникальные категории из businesses.categories (text[])
        const admin = createClient(URL, SERVICE);
        const {data, error} = await admin
            .from('businesses')
            .select('categories')
            .limit(10000)
            .returns<BizCategoriesRow[]>();

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        const set = new Set<string>();
        for (const row of data ?? []) {
            for (const c of row.categories ?? []) {
                const v = c?.trim();
                if (v) set.add(v);
            }
        }

        return NextResponse.json({ok: true, data: Array.from(set).sort()});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('categories suggest error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
