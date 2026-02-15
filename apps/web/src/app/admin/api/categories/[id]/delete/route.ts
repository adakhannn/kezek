// apps/web/src/app/admin/api/categories/[id]/delete/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {logError} from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';

type Body = { force?: boolean };
type CategoryRow = { id: string; slug: string };

export async function POST(req: Request, context: unknown) {
    try {
        const categoryId = await getRouteParamRequired(context, 'id');
        
        const URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        // Проверяем, что вызвал залогиненный супер-админ
        const cookieStore = await cookies(); // без await
        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
        if (eSuper)  return NextResponse.json({ ok: false, error: eSuper.message }, { status: 400 });
        if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        // Service-клиент для админских операций
        const admin = createClient(URL, SERVICE);

        // Тело запроса (force может отсутствовать)
        const { force = false } = (await req.json().catch(() => ({}))) as Body;

        // Находим категорию
        const { data: cat, error: eCat } = await admin
            .from('categories')
            .select('id,slug')
            .eq('id', categoryId)
            .maybeSingle<CategoryRow>();

        if (eCat)   return NextResponse.json({ ok: false, error: eCat.message }, { status: 400 });
        if (!cat)   return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

        // Считаем, где используется
        const { count, error: eCnt } = await admin
            .from('businesses')
            .select('id', { count: 'exact', head: true })
            .contains('categories', [cat.slug]);

        if (eCnt) return NextResponse.json({ ok: false, error: eCnt.message }, { status: 400 });

        // Если используется и force не включён — стоп
        if ((count ?? 0) > 0 && !force) {
            return NextResponse.json(
                { ok: false, error: `Категория используется в ${count} бизнес(-ах). Удалите связи или включите force.` },
                { status: 400 },
            );
        }

        // Если используется и force включён — удаляем slug из всех businesses.categories
        if ((count ?? 0) > 0 && force) {
            const { error: eRm } = await admin.rpc('cat_remove_slug', { the_slug: cat.slug });
            if (eRm) return NextResponse.json({ ok: false, error: eRm.message }, { status: 400 });
        }

        // Удаляем саму категорию
        const { error: eDel } = await admin.from('categories').delete().eq('id', cat.id);
        if (eDel) return NextResponse.json({ ok: false, error: eDel.message }, { status: 400 });

        return NextResponse.json({ ok: true, removed: count ?? 0 });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('CategoryDelete', 'Failed to delete category', e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

// поддержим HTTP DELETE
export const DELETE = POST;

