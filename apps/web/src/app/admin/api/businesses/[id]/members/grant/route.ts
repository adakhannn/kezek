// apps/web/src/app/admin/api/businesses/[id]/members/grant/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import { DATABASE_FAILURE_MESSAGES, publicErrorMessage, reportDatabaseError } from '@/lib/apiErrorHandler';
import {
    canAssignBusinessRole,
    parseBusinessMemberRoleKey,
    resolveBusinessMemberActor,
} from '@/lib/businessMemberRolePolicy';
import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { isUuid } from '@/lib/validation';

export async function POST(req: Request, context: unknown) {
    try {
        const biz_id = await getRouteParamRequired(context, 'id');

        const supa = await createSupabaseServerClient();

        // проверка авторизации/прав
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        // super_admin (global) ИЛИ owner/admin данного бизнеса; дальше — иерархия ролей
        const actor = await resolveBusinessMemberActor(supa, biz_id);
        if (!actor) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // входные данные
        const body = (await req.json().catch(() => null)) as { user_id?: unknown; role_key?: unknown } | null;
        const user_id = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
        if (!isUuid(user_id)) return NextResponse.json({ok: false, error: 'bad user_id'}, {status: 400});
        const role_key = body?.role_key === undefined ? 'client' : parseBusinessMemberRoleKey(body.role_key);
        if (!role_key) return NextResponse.json({ok: false, error: 'bad role_key'}, {status: 400});
        if (!canAssignBusinessRole(actor, role_key)) {
            return NextResponse.json({ok: false, error: 'forbidden_role'}, {status: 403});
        }

        const admin = createSupabaseAdminClient();

        // находим role_id по ключу
        const {data: roleRow, error: roleErr} = await admin
            .from('roles')
            .select('id')
            .eq('key', role_key)
            .maybeSingle();
        if (roleErr || !roleRow) {
            return NextResponse.json({ok: false, error: 'role not found'}, {status: 400});
        }

        // ПИШЕМ ЧЕРЕЗ INSERT, а дубль игнорим по 23505 (unique_violation)
        const {error: insErr} = await admin
            .from('user_roles')
            .insert({user_id, role_id: roleRow.id, biz_id});

        if (insErr && insErr.code !== '23505') {
            // 23505 — уже есть такая роль → не считаем ошибкой
            return NextResponse.json({ok: false, error: reportDatabaseError('AdminMembersGrant', insErr, DATABASE_FAILURE_MESSAGES.save)}, {status: 400});
        }

        // если выдаём 'owner' — обновим поле owner_id у бизнеса
        if (role_key === 'owner') {
            await admin.from('businesses').update({owner_id: user_id}).eq('id', biz_id);
        }

        return NextResponse.json({ok: true});
    } catch (e) {
        logError('AdminMembersGrant', 'Failed to grant business role', e);
        const msg = publicErrorMessage(e, DATABASE_FAILURE_MESSAGES.internal);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
