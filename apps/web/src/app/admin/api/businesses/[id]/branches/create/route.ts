// apps/web/src/app/admin/api/businesses/[id]/branches/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { branchCreateError, resolveInitialDirectoryLinks } from '@/lib/branchCreateService';
import { validatePublicContacts, type PublicContactFields } from '@/lib/businessContacts';
import {logError} from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { validateLatLon } from '@/lib/validation';

type Body = PublicContactFields & {
    name: string;
    address?: string | null;
    is_active?: boolean;
    lat?: number | null;
    lon?: number | null;
    directory_links?: Record<string, string | null>;
    inherit_business_contacts?: boolean;
};

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

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

        const contacts = validatePublicContacts(body);
        if (!contacts.ok) return NextResponse.json({ ok: false, error: contacts.message }, { status: 400 });

        let coordsWkt: string | null = null;
        if (body.lat != null || body.lon != null) {
            if (body.lat == null || body.lon == null) {
                return NextResponse.json({ ok: false, error: 'Укажите обе координаты филиала' }, { status: 400 });
            }
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
                directory_links: await resolveInitialDirectoryLinks(
                    admin,
                    bizId,
                    body.directory_links && typeof body.directory_links === 'object' ? body.directory_links : {},
                ),
                ...contacts.value,
                inherit_business_contacts: body.inherit_business_contacts !== false,
            })
            .select('id')
            .maybeSingle();

        if (error) {
            const mapped = branchCreateError(error);
            return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
        }

        return NextResponse.json({ ok: true, id: data?.id });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('BranchCreate', 'Failed to create branch', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
