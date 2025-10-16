// apps/web/src/app/admin/api/roles/[id]/update/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = { name?: string | null; description?: string | null };

export async function POST(req: Request, {params}: { params: { id: string } }) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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

        const {data: superRow, error: roleErr} = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (roleErr || !superRow) {
            return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});
        }

        const body = (await req.json()) as Body;
        const patch: Record<string, unknown> = {};
        if ('name' in body) patch.name = (body.name ?? '').trim();
        if ('description' in body) patch.description = (body.description ?? '') || null;

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ok: true});
        }

        // не даём менять key/is_system через этот роут
        const {error} = await supa
            .from('roles')
            .update(patch)
            .eq('id', params.id);

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
