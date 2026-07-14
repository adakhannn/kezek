export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getRouteParamRequired } from '@/lib/routeParams';

type Body = {
    name?: string;
    slug?: string;
    categories?: string[] | null;
    address?: string | null;
    phones?: string[] | null;
    is_approved?: boolean;
};

function validSlug(s: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

export async function PATCH(req: Request, context: unknown) {
    try {
        const bizId = await getRouteParamRequired(context, 'id');

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value,
                set: () => {},
                remove: () => {},
            },
        });

        const {
            data: { user },
        } = await supa.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
        }

        const { data: isSuper, error: superErr } = await supa.rpc('is_super_admin');

        if (superErr || !isSuper) {
            return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
        }

        const body = (await req.json()) as Body;
        const admin = createClient(URL, SERVICE);

        const { data: existing, error: fetchErr } = await admin
            .from('businesses')
            .select('id, slug')
            .eq('id', bizId)
            .maybeSingle();

        if (fetchErr || !existing) {
            return NextResponse.json({ ok: false, error: 'business not found' }, { status: 404 });
        }

        const updates: Record<string, unknown> = {};

        if (body.name !== undefined) {
            const name = typeof body.name === 'string' ? body.name.trim() : '';
            if (!name) {
                return NextResponse.json({ ok: false, error: 'name cannot be empty' }, { status: 400 });
            }
            updates.name = name;
        }

        if (body.slug !== undefined) {
            const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
            if (!slug || !validSlug(slug)) {
                return NextResponse.json({ ok: false, error: 'invalid slug' }, { status: 400 });
            }
            if (slug !== existing.slug) {
                const { data: conflict } = await admin
                    .from('businesses')
                    .select('id')
                    .eq('slug', slug)
                    .neq('id', bizId)
                    .limit(1)
                    .maybeSingle();
                if (conflict) {
                    return NextResponse.json({ ok: false, error: 'slug is already taken' }, { status: 409 });
                }
            }
            updates.slug = slug;
        }

        if (body.categories !== undefined) {
            if (body.categories === null || (Array.isArray(body.categories) && body.categories.length === 0)) {
                updates.categories = [];
            } else if (Array.isArray(body.categories)) {
                const slugs = body.categories.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim());
                const { data: catRows } = await admin.from('categories').select('slug,is_active').in('slug', slugs);
                const validSet = new Set((catRows || []).filter((c) => c.is_active !== false).map((c) => c.slug));
                const invalid = slugs.filter((s) => !validSet.has(s));
                if (invalid.length) {
                    return NextResponse.json({ ok: false, error: `invalid categories: ${invalid.join(', ')}` }, { status: 400 });
                }
                updates.categories = slugs;
            } else {
                return NextResponse.json({ ok: false, error: 'categories must be array or null' }, { status: 400 });
            }
        }

        if (body.address !== undefined) {
            updates.address = body.address === null || body.address === '' ? null : String(body.address).trim() || null;
        }

        if (body.phones !== undefined) {
            updates.phones = body.phones === null ? null : Array.isArray(body.phones) ? body.phones.filter((p): p is string => typeof p === 'string').map((p) => p.trim()).filter(Boolean) : [];
        }

        if (body.is_approved !== undefined) {
            updates.is_approved = !!body.is_approved;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ ok: true, data: existing });
        }

        const { data: updated, error: updateErr } = await admin
            .from('businesses')
            .update(updates)
            .eq('id', bizId)
            .select()
            .single();

        if (updateErr) {
            return NextResponse.json({ ok: false, error: updateErr.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, data: updated });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
