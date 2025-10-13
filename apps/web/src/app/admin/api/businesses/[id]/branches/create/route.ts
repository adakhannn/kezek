// apps/web/src/app/admin/api/businesses/[id]/branches/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Body = { name: string; address?: string | null; is_active?: boolean };

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

export async function POST(req: Request, context: unknown) {
    // безопасно достаём params.id без any
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
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ ok: false, error: eSuper.message }, { status: 400 });
        if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        const admin = createClient(URL, SERVICE);
        const body = (await req.json()) as Body;

        const name = norm(body.name);
        if (!name) return NextResponse.json({ ok: false, error: 'Название обязательно' }, { status: 400 });

        const { data, error } = await admin
            .from('branches')
            .insert({
                biz_id: bizId,
                name,
                address: norm(body.address),
                is_active: body.is_active ?? true,
            })
            .select('id')
            .maybeSingle();

        if (error) {
            const code = (error as { code?: string }).code;
            const msg = code ? `${error.message} (code ${code})` : error.message;
            return NextResponse.json({ ok: false, error: msg }, { status: 400 });
        }

        return NextResponse.json({ ok: true, id: data?.id });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('branch create error', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

