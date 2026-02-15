// apps/web/src/app/admin/api/categories/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient, PostgrestError} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import {logError} from '@/lib/log';

type Body = { name_ru: string; slug?: string | null; is_active?: boolean };
type InsertedId = { id: string };

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

function slugify(input: string) {
    // RU + KG (ө, ү, ң) базовая транслитерация
    const map: Record<string, string> = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
        м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh',
        щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
        ө: 'o', ү: 'u', ң: 'ng',
    };
    return input
        .toLowerCase()
        .split('')
        .map((ch) => map[ch] ?? ch)
        .join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/--+/g, '-');
}

export async function POST(req: Request) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        const cookieStore = await cookies(); // без await
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        // доступ только супер-админу
        const {
            data: {user},
        } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        const admin = createClient(URL, SERVICE);
        const b = (await req.json()) as Body;

        const name_ru = norm(b.name_ru);
        if (!name_ru) return NextResponse.json({ok: false, error: 'Название обязательно'}, {status: 400});

        const slug = norm(b.slug) ?? slugify(name_ru);
        if (!/^[a-z0-9-]{2,}$/.test(slug)) {
            return NextResponse.json({ok: false, error: 'Некорректный slug'}, {status: 400});
        }

        const {data, error} = await admin
            .from('categories')
            .insert({name_ru, slug, is_active: b.is_active ?? true})
            .select('id')
            .maybeSingle<InsertedId>();

        if (error) {
            const pgErr = error as PostgrestError;
            const isDuplicate = pgErr.code === '23505' || /duplicate|unique/i.test(pgErr.message);
            return NextResponse.json(
                {ok: false, error: isDuplicate ? 'Такой slug уже существует' : pgErr.message},
                {status: isDuplicate ? 409 : 400},
            );
        }

        return NextResponse.json({ok: true, id: data?.id});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('CategoryCreate', 'Failed to create category', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
