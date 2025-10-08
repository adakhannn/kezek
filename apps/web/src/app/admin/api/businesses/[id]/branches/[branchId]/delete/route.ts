// apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/delete/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient, type PostgrestError} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

// Аккуратно парсим id и branchId из URL, без any
function extractIds(urlStr: string): { id: string; branchId: string } {
    const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
    // .../admin/api/businesses/{id}/branches/{branchId}/delete
    const iBiz = parts.findIndex(p => p === 'businesses');
    const iBranches = parts.findIndex((p, i) => i > iBiz && p === 'branches');
    const id = iBiz >= 0 ? parts[iBiz + 1] ?? '' : '';
    const branchId = iBranches >= 0 ? parts[iBranches + 1] ?? '' : '';
    return {id, branchId};
}

export async function POST(req: Request) {
    try {
        const {id, branchId} = extractIds(req.url);

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

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

        const admin = createClient(URL, SERVICE);

        const {error} = await admin
            .from('branches')
            .delete()
            .eq('id', branchId)
            .eq('biz_id', id);

        if (error) {
            const pgErr = error as PostgrestError;
            const friendly =
                pgErr.code === '23503' || /foreign key/i.test(pgErr.message)
                    ? 'Нельзя удалить: филиал используется (есть сотрудники/записи). Сначала перенесите или удалите связанные данные.'
                    : pgErr.message;
            return NextResponse.json({ok: false, error: friendly}, {status: 400});
        }

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        console.error('branch delete error', e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

// поддержим HTTP DELETE
export const DELETE = POST;
