// apps/web/src/app/admin/api/categories/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import { DATABASE_FAILURE_MESSAGES, reportDatabaseError } from '@/lib/apiErrorHandler';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function GET() {

    const supa = await createSupabaseServerClient();

    const {data: {user}} = await supa.auth.getUser();
    if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});
    const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
    if (eSuper) return NextResponse.json({ok: false, error: reportDatabaseError('AdminCategoriesList', eSuper)}, {status: 400});
    if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

    // берём из RPC с usage_count
    const {data, error} = await supa.rpc('categories_with_usage_v2');
    if (error) return NextResponse.json({ok: false, error: reportDatabaseError('AdminCategoriesList', error, DATABASE_FAILURE_MESSAGES.load)}, {status: 400});
    return NextResponse.json({ok: true, items: data ?? []});
}
