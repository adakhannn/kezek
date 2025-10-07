// apps/web/src/app/admin/api/users/[id]/update-basic/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {AdminUserAttributes, createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
};

type ProfilesRow = { id: string; full_name: string | null };

export async function POST(req: Request, {params}: { params: { id: string } }) {
    try {
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

        const {
            data: {user},
        } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        const admin = createClient(URL, SERVICE);
        const raw = (await req.json()) as Body;

        // Нормализация и отсечение пустых строк
        const full_name = (raw.full_name ?? '').trim();
        const email = (raw.email ?? '').trim();
        const phone = (raw.phone ?? '').trim();

        // Обновление email / phone через Admin API (если поля присутствуют в теле запроса)
        if ('email' in raw || 'phone' in raw) {
            const updatePayload: { email?: string | null; phone?: string | null } = {};
            if ('email' in raw) updatePayload.email = email || null;
            if ('phone' in raw) updatePayload.phone = phone || null;

            const {error: eUpdAuth} = await admin.auth.admin.updateUserById(params.id, <AdminUserAttributes>updatePayload);
            if (eUpdAuth) {
                return NextResponse.json({ok: false, error: eUpdAuth.message}, {status: 400});
            }
        }

        // Обновление имени в profiles (idempotent upsert по id)
        if ('full_name' in raw) {
            const {error: eProf} = await admin
                .from('profiles')
                .upsert(
                    {id: params.id, full_name: full_name || null} satisfies ProfilesRow,
                    {onConflict: 'id'},
                );
            if (eProf) {
                return NextResponse.json({ok: false, error: eProf.message}, {status: 400});
            }
        }

        return NextResponse.json({ok: true});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('update-basic error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

