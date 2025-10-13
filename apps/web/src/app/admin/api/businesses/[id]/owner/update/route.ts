// apps/web/src/app/admin/api/businesses/[id]/owner/update/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = { full_name?: string | null; email?: string | null; phone?: string | null };
type BizOwnerRow = { owner_id: string | null };
type UpdateUserPayload = {
    email?: string;                 // важно: без null
    phone?: string;                 // важно: без null
    user_metadata?: { full_name?: string };
};

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

export async function POST(req: Request, context: unknown) {
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string> }).params
            : {};
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // проверка прав
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
        const bizId = params.id;
        const body = (await req.json()) as Body;

        // узнаём owner_id (без .returns<> / дженериков)
        const {data: biz, error: eBiz} = await admin
            .from('businesses')
            .select('owner_id')
            .eq('id', bizId)
            .maybeSingle();

        if (eBiz) return NextResponse.json({ok: false, error: eBiz.message}, {status: 400});
        const b = biz as BizOwnerRow | null;
        const ownerId = b?.owner_id ?? null;
        if (!ownerId) return NextResponse.json({ok: false, error: 'Владелец не назначен'}, {status: 400});

        // собираем атрибуты (email/phone строго string | undefined)
        const emailVal = norm(body.email) ?? undefined;
        const phoneVal = norm(body.phone) ?? undefined;
        const fullNameVal = norm(body.full_name) ?? undefined;

        if (emailVal === undefined && phoneVal === undefined && fullNameVal === undefined) {
            return NextResponse.json({ok: true, updated: false});
        }

        const payload: UpdateUserPayload = {};
        if (emailVal !== undefined) payload.email = emailVal;
        if (phoneVal !== undefined) payload.phone = phoneVal;
        if (fullNameVal !== undefined) payload.user_metadata = {full_name: fullNameVal};

        const {data: upd, error: eUpd} = await admin.auth.admin.updateUserById(ownerId, payload);
        if (eUpd) return NextResponse.json({ok: false, error: eUpd.message}, {status: 400});

        return NextResponse.json({ok: true, updated: true, user: upd?.user?.id ?? ownerId});
    } catch (e: unknown) {
        console.error('owner update error', e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
