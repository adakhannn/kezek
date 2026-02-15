// apps/web/src/app/admin/api/categories/[id]/update/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient, PostgrestError} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import {logError} from '@/lib/log';

type Body = {
    name_ru?: string | null;
    slug?: string | null;         // null => сгенерировать из name_ru/текущего имени
    is_active?: boolean;
    propagateSlug?: boolean;
};

type CategoryRow = {
    id: string;
    slug: string;
    name_ru: string | null;
    is_active: boolean;
};

type Patch = Partial<Pick<CategoryRow, 'name_ru' | 'slug' | 'is_active'>>;

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

function slugify(input: string) {
    // RU + KG (ө, ү, ң) простая транслитерация
    const map: Record<string, string> = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
        м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh',
        щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ө: 'o', ү: 'u', ң: 'ng',
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

function isSlugValid(s: string) {
    return /^[a-z0-9-]{2,}$/.test(s);
}

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

        const cookieStore = await cookies(); // без await
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        // доступ только супер-админу
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});
        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        const admin = createClient(URL, SERVICE);
        const body = (await req.json()) as Body;

        // текущая категория
        const {data: cur, error: eCur} = await admin
            .from('categories')
            .select('id,slug,name_ru,is_active')
            .eq('id', params.id)
            .maybeSingle<CategoryRow>();

        if (eCur) return NextResponse.json({ok: false, error: eCur.message}, {status: 400});
        if (!cur) return NextResponse.json({ok: false, error: 'not_found'}, {status: 404});

        const patch: Patch = {};

        // name_ru — NOT NULL: если поле передали, не даём сделать пустым
        if (body.name_ru !== undefined) {
            const v = norm(body.name_ru);
            if (!v) return NextResponse.json({ok: false, error: 'Название обязательно'}, {status: 400});
            patch.name_ru = v;
        }

        if (body.is_active !== undefined) {
            patch.is_active = !!body.is_active;
        }

        // slug:
        // - если slug передан строкой => нормализуем и валидируем
        // - если slug === null => сгенерировать из нового name_ru (если меняли) или из текущего name_ru
        if (body.slug !== undefined) {
            let targetSlug = norm(body.slug);
            if (targetSlug === null) {
                const baseName = (patch.name_ru ?? cur.name_ru ?? '').trim();
                if (!baseName) return NextResponse.json({
                    ok: false,
                    error: 'Не из чего сгенерировать slug'
                }, {status: 400});
                targetSlug = slugify(baseName);
            }
            if (!targetSlug || !isSlugValid(targetSlug)) {
                return NextResponse.json({ok: false, error: 'Некорректный slug'}, {status: 400});
            }
            patch.slug = targetSlug;
        }

        // если slug меняется и надо «распропагировать» его в businesses.categories — делаем это сервис-клиентом
        const slugChanged = patch.slug && patch.slug !== cur.slug;
        if (slugChanged && body.propagateSlug) {
            const {error: eRep} = await admin.rpc('cat_replace_slug', {
                old_slug: cur.slug,
                new_slug: patch.slug,
            });
            if (eRep) return NextResponse.json({ok: false, error: eRep.message}, {status: 400});
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ok: true, updated: false, slug: cur.slug});
        }

        const {error: eUpd} = await admin.from('categories').update(patch).eq('id', params.id);
        if (eUpd) {
            const pgErr = eUpd as PostgrestError;
            const isDup = pgErr.code === '23505' || /duplicate|unique/i.test(pgErr.message);
            return NextResponse.json(
                {ok: false, error: isDup ? 'Такой slug уже существует' : pgErr.message},
                {status: isDup ? 409 : 400},
            );
        }

        return NextResponse.json({ok: true, updated: true, slug: patch.slug ?? cur.slug});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('CategoryUpdate', 'Failed to update category', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
