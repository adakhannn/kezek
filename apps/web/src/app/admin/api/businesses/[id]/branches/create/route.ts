// apps/web/src/app/admin/api/businesses/[id]/branches/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getRouteParamRequired } from '@/lib/routeParams';

type Body = {
    name: string;
    address?: string | null;
    is_active?: boolean;
    lat?: number | null;
    lon?: number | null;
};

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

function validateLatLon(lat: unknown, lon: unknown) {
    if (lat == null || lon == null) return { ok: false as const };
    const la = Number(lat), lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return { ok: false as const };
    if (la < -90 || la > 90 || lo < -180 || lo > 180) return { ok: false as const };
    return { ok: true as const, lat: la, lon: lo };
}

export async function POST(req: Request, context: unknown) {
    try {
        const bizId = await getRouteParamRequired(context, 'id');
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
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

        // ТОЛЬКО coords (EWKT). lat/lon НЕ отправляем — их заполнит БД.
        let coordsWkt: string | null = null;
        if (body.lat != null || body.lon != null) {
            const v = validateLatLon(body.lat, body.lon);
            if (!v.ok) return NextResponse.json({ ok: false, error: 'Некорректные координаты' }, { status: 400 });
            coordsWkt = `SRID=4326;POINT(${v.lon} ${v.lat})`;
        }

        const { data, error } = await admin
            .from('branches')
            .insert({
                biz_id: bizId,
                name,
                address: norm(body.address),
                is_active: body.is_active ?? true,
                coords: coordsWkt, // ← только это поле
            })
            .select('id')
            .maybeSingle();

        if (error) {
            const code = (error as { code?: string }).code;
            return NextResponse.json({ ok: false, error: `${error.message}${code ? ` (code ${code})` : ''}` }, { status: 400 });
        }

        return NextResponse.json({ ok: true, id: data?.id });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('branch create error', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
