// apps/web/src/app/admin/api/businesses/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Body = {
    name?: string;
    slug?: string;
    categories?: string[]; // массив slug'ов из справочника
};

function validSlug(s: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

export async function POST(req: Request) {
    try {
        const { name, slug, categories }: Body = await req.json();

        if (!name || !name.trim()) {
            return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
        }
        if (!slug || !slug.trim() || !validSlug(slug.trim())) {
            return NextResponse.json({ ok: false, error: 'invalid slug' }, { status: 400 });
        }
        if (!Array.isArray(categories) || categories.length === 0) {
            return NextResponse.json({ ok: false, error: 'at least one category is required' }, { status: 400 });
        }

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // Проверяем, что вызывающий — супер
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value,
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

        const { data: superRow, error: superErr } = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (superErr) {
            return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        }
        if (!superRow) {
            return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
        }

        // Сервисный клиент: пишем в public.businesses
        const admin = createClient(URL, SERVICE);

        // 1) Проверим уникальность slug
        const { data: exists, error: existsErr } = await admin
            .from('businesses')
            .select('id')
            .eq('slug', slug.trim())
            .limit(1)
            .maybeSingle();

        if (existsErr) {
            return NextResponse.json({ ok: false, error: existsErr.message }, { status: 400 });
        }
        if (exists) {
            return NextResponse.json({ ok: false, error: 'slug is already taken' }, { status: 409 });
        }

        // 2) (опционально) Проверим, что все категории валидны и активны
        const { data: catRows, error: catErr } = await admin
            .from('categories')
            .select('slug,is_active')
            .in('slug', categories);

        if (catErr) {
            return NextResponse.json({ ok: false, error: catErr.message }, { status: 400 });
        }
        const validSet = new Set((catRows || []).filter((c) => c.is_active !== false).map((c) => c.slug));
        const invalid = categories.filter((sl) => !validSet.has(sl));
        if (invalid.length) {
            return NextResponse.json({ ok: false, error: `invalid categories: ${invalid.join(', ')}` }, { status: 400 });
        }

        // 3) Вставка бизнеса. ВАЖНО: address не указываем (NULL), owner_id = NULL
        const { data: ins, error: insErr } = await admin
            .from('businesses')
            .insert({
                name: name.trim(),
                slug: slug.trim(),
                address: null,      // адресов на этом шаге нет
                owner_id: null,     // владельца назначаем отдельно
                categories,         // text[] со slug'ами
            })
            .select('id')
            .maybeSingle();

        if (insErr) {
            return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
        }
        if (!ins?.id) {
            return NextResponse.json({ ok: false, error: 'failed to create business' }, { status: 500 });
        }

        return NextResponse.json({ ok: true, id: ins.id });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export const PUT = POST;
