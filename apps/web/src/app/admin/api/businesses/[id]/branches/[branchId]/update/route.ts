// apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/update/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = { name?: string | null; address?: string | null; is_active?: boolean };
type Patch = Partial<{ name: string | null; address: string | null; is_active: boolean }>;

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

async function handler(req: Request, {params}: { params: { id: string; branchId: string } }) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // Проверка прав
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

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // Обновление
        const admin = createClient(URL, SERVICE);
        const body = (await req.json()) as Body;

        const patch: Patch = {};
        if ('name' in body) patch.name = norm(body.name);
        if ('address' in body) patch.address = norm(body.address);
        if ('is_active' in body) patch.is_active = !!body.is_active;

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ok: true, updated: false});
        }

        const {error} = await admin
            .from('branches')
            .update(patch)
            .eq('id', params.branchId)
            .eq('biz_id', params.id);

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        return NextResponse.json({ok: true, updated: true});
    } catch (e: unknown) {
         
        console.error('branch update error', e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

export const POST = handler;
export const PATCH = handler;
export const PUT = handler;

export function OPTIONS() {
    return new Response(null, {status: 204});
}

