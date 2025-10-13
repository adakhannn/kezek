// apps/web/src/app/admin/api/businesses/[id]/delete/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, context: unknown) {
    // безопасно достаём params.id
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};
    const rawId = (params as Record<string, string | string[]>).id;
    const bizId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!bizId) {
        return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 });
    }

    try {
        const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ ok: false, error: eSuper.message }, { status: 400 });
        if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        const { error } = await supa.rpc('delete_business_cascade', { p_biz_id: bizId });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('delete business error', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

// поддержим HTTP DELETE
export const DELETE = POST;

