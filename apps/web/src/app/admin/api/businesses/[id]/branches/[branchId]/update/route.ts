// apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/update/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {logError} from '@/lib/log';
import { validateLatLon } from '@/lib/validation';

type Body = {
    name?: string | null;
    address?: string | null;
    is_active?: boolean;
    lat?: number | null;
    lon?: number | null;
};

type Patch = Partial<{ name: string | null; address: string | null; is_active: boolean }> & { [k: string]: unknown };

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

function extractIds(urlStr: string): { id: string; branchId: string } {
    const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
    const iBiz = parts.findIndex((p) => p === 'businesses');
    const iBranches = parts.findIndex((p, i) => i > iBiz && p === 'branches');
    return { id: iBiz >= 0 ? parts[iBiz + 1] ?? '' : '', branchId: iBranches >= 0 ? parts[iBranches + 1] ?? '' : '' };
}

async function handler(req: Request) {
    try {
        const { id, branchId } = extractIds(req.url);

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

        const patch: Patch = {};
        if ('name' in body) patch.name = norm(body.name);
        if ('address' in body) patch.address = norm(body.address);
        if ('is_active' in body) patch.is_active = !!body.is_active;

        // Координаты: меняем ТОЛЬКО coords; lat/lon не трогаем (их пересчитает БД)
        if ('lat' in body || 'lon' in body) {
            if (body.lat != null && body.lon != null) {
                const v = validateLatLon(body.lat, body.lon);
                if (!v.ok) return NextResponse.json({ ok: false, error: 'Некорректные координаты' }, { status: 400 });
                patch.coords = `SRID=4326;POINT(${v.lon} ${v.lat})`;
            } else {
                patch.coords = null;
            }
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ ok: true, updated: false });
        }

        const { error } = await admin
            .from('branches')
            .update(patch)
            .eq('id', branchId)
            .eq('biz_id', id);

        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, updated: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('BranchUpdate', 'Failed to update branch', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export function OPTIONS() { return new Response(null, { status: 204 }); }
