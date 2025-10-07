// apps/web/src/app/admin/api/businesses/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

const OK_SLUG = /^[a-z0-9-]{2,}$/;
const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};
const uniq = <T, >(a: T[]) => Array.from(new Set(a));

type Body = {
    name: string;
    slug: string;
    address?: string | null;
    categories?: string[];       // массив slug-ов категорий
};

export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!URL || !ANON || !SERVICE) {
            return NextResponse.json({ok: false, error: 'ENV missing (URL/ANON/SERVICE)'}, {status: 500});
        }

        const body = (await req.json()) as Body;
        const name = norm(body.name);
        const slug = norm(body.slug);
        if (!name) return NextResponse.json({ok: false, error: 'Название обязательно'}, {status: 400});
        if (!slug || !OK_SLUG.test(slug)) {
            return NextResponse.json({ok: false, error: 'Некорректный slug'}, {status: 400});
        }

        // Только super_admin
        const cookieStore = await cookies(); // без await
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

        // Нормализация входных
        const address = norm(body.address);
        let categories = uniq((body.categories ?? []).map((c) => c.trim()).filter(Boolean));

        // (Опционально, но полезно) — валидируем категории по справочнику:
        if (categories.length) {
            const {data: catRows, error: eCats} = await admin
                .from('categories')
                .select('slug,is_active');
            if (eCats) return NextResponse.json({ok: false, error: eCats.message}, {status: 400});

            const allowed = new Set((catRows ?? []).map((r) => r.slug));
            const unknown = categories.filter((c) => !allowed.has(c));
            if (unknown.length) {
                return NextResponse.json(
                    {ok: false, error: `Неизвестные категории: ${unknown.join(', ')}`},
                    {status: 400},
                );
            }
        }

        // дефолтная категория, если не передали
        if (!categories.length) categories = ['barbershop'];

        const tz = 'Asia/Bishkek';

        const {data: biz, error: eBiz} = await admin
            .from('businesses')
            .insert({
                name,
                slug,
                address,
                categories,
                tz,
                is_approved: true,
                plan: 'pro',
            })
            .select('id,slug')
            .maybeSingle<{ id: string; slug: string }>();

        if (eBiz) {
            const msg = /duplicate key value.*slug/i.test(eBiz.message)
                ? 'Такой slug уже существует'
                : eBiz.message;
            return NextResponse.json({ok: false, error: msg}, {status: 400});
        }
        if (!biz?.id) {
            return NextResponse.json({ok: false, error: 'insert businesses failed'}, {status: 500});
        }

        // Создаём дефолтный филиал, если указан адрес
        if (address) {
            const {error: eBranch} = await admin
                .from('branches')
                .insert({biz_id: biz.id, name: 'Основной филиал', address, is_active: true});
            if (eBranch) return NextResponse.json({ok: false, error: eBranch.message}, {status: 400});
        }

        return NextResponse.json({ok: true, id: biz.id, slug: biz.slug});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('biz create error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
