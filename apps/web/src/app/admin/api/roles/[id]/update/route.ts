// apps/web/src/app/admin/api/roles/[id]/update/route.ts
import {NextResponse} from 'next/server';

import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { getRouteParam } from '@/lib/routeParams';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { name?: string | null; description?: string | null };

const norm = (v?: string | null) => {
    const s = (v ?? '').trim();
    return s.length ? s : null;
};

export async function POST(req: Request, context: unknown) {
    try {
        // безопасно достаём id из контекста
        const id = await getRouteParam(context, 'id');
        if (!id) {
            return NextResponse.json({ok: false, error: 'missing id'}, {status: 400});
        }

        const supa = await createSupabaseServerClient();

        const { data: { user }, error: authError } = await supa.auth.getUser();
        if (authError || !user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        // проверка глобальной роли super_admin (biz_id IS NULL)
        const { isSuperAdmin: superRow, error: roleErr } = await checkCurrentUserIsSuperAdmin(supa, user.id);

        if (roleErr || !superRow) {
            return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});
        }

        const body = (await req.json()) as Body;

        // Собираем patch только из переданных полей
        const patch: Database['public']['Tables']['roles']['Update'] = {};
        if ('name' in body) {
            const v = norm(body.name);
            // roles.name is NOT NULL: an empty name is rejected instead of failing in the database.
            if (v === null) return NextResponse.json({ok: false, error: 'Название обязательно'}, {status: 400});
            patch.name = v;
        }
        if ('description' in body) {
            patch.description = norm(body.description); // null если пусто
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ok: true});
        }

        // key / is_system не меняем этим роутом
        const {error} = await supa.from('roles').update(patch).eq('id', id);

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

// На всякий — позволим PATCH/PUT той же логикой
export const PATCH = POST;
export const PUT = POST;
