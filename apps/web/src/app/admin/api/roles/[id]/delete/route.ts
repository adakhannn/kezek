// apps/web/src/app/admin/api/roles/[id]/delete/route.ts
import {NextResponse} from 'next/server';

import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { logError } from '@/lib/log';
import { getRouteParam } from '@/lib/routeParams';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, context: unknown) {
    try {
        // Аккуратно достаём id из контекста
        const id = await getRouteParam(context, 'id');
        if (!id) {
            return NextResponse.json({ok: false, error: 'missing id'}, {status: 400});
        }

        const supa = await createSupabaseServerClient();

        // auth
        const { data: { user }, error: authError } = await supa.auth.getUser();
        if (authError || !user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        // проверка super_admin (глобальная роль с biz_id IS NULL)
        const { isSuperAdmin: superRow, error: roleErr } = await checkCurrentUserIsSuperAdmin(supa, user.id);

        if (roleErr || !superRow) {
            return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});
        }

        // запретим удаление системных ролей
        const {data: roleRow, error: roleGetErr} = await supa
            .from('roles')
            .select('is_system')
            .eq('id', id)
            .maybeSingle();

        if (roleGetErr) return NextResponse.json({ok: false, error: roleGetErr.message}, {status: 400});
        if (!roleRow) return NextResponse.json({ok: false, error: 'not found'}, {status: 404});
        if (roleRow.is_system) {
            return NextResponse.json({ok: false, error: 'Системную роль удалять нельзя'}, {status: 400});
        }

        const {error} = await supa.from('roles').delete().eq('id', id);

        if (error) {
            const friendly =
                /23503/.test((error).code ?? '') || /foreign key/i.test(error.message)
                    ? 'Нельзя удалить: роль используется. Сначала уберите её из user_roles.'
                    : error.message;
            return NextResponse.json({ok: false, error: friendly}, {status: 400});
        }

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        logError('AdminRoles', 'Failed to delete role', e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

// поддержим HTTP DELETE той же логикой
export const DELETE = POST;
