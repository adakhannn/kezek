// apps/web/src/app/admin/api/categories/suggest/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import {logError} from '@/lib/log';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

type BizCategoriesRow = { categories: string[] | null };

export async function GET() {
    try {
        // проверяем, что вызвал супер-админ
 // без await
        const supabase = await createSupabaseServerClient();

        const {
            data: {user},
        } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supabase.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // собираем уникальные категории из businesses.categories (text[])
        const admin = createSupabaseAdminClient();
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
        logError('CategorySuggest', 'Failed to suggest categories', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
