export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import {
    canChangeBusinessMember,
    loadBusinessMemberRoleKeys,
    resolveBusinessMemberActor,
} from '@/lib/businessMemberRolePolicy';
import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { isUuid } from '@/lib/validation';

type Body = { user_id?: string };

export async function POST(req: Request, context: unknown) {
    try {
        const biz_id = await getRouteParamRequired(context, 'id');
        
        if (!isUuid(biz_id)) {
            return NextResponse.json({ok: false, error: 'bad biz_id'}, {status: 400});
        }

        const supa = await createSupabaseServerClient();

        // auth
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        // доступ: super_admin глобально ИЛИ owner/admin этого бизнеса
        const actor = await resolveBusinessMemberActor(supa, biz_id);
        if (!actor) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        const body = (await req.json().catch(() => null)) as Body | null;
        const user_id = typeof body?.user_id === 'string' ? body.user_id : '';
        if (!isUuid(user_id)) {
            return NextResponse.json({ok: false, error: 'bad user_id'}, {status: 400});
        }

        const admin = createSupabaseAdminClient();

        // demote снимает все роли кроме client — цель должна быть «ниже» вызывающего
        const targetRoles = await loadBusinessMemberRoleKeys(admin, biz_id, user_id);
        if (!targetRoles.ok) {
            logError('AdminMembersDemote', 'Could not load the member roles', { bizId: biz_id });
            return NextResponse.json({ok: false, error: 'internal'}, {status: 500});
        }
        if (!canChangeBusinessMember(actor, targetRoles.keys)) {
            return NextResponse.json({ok: false, error: 'forbidden_member'}, {status: 403});
        }

        // найдём role_id для client
        const {data: clientRole, error: roleErr} = await admin
            .from('roles')
            .select('id')
            .eq('key', 'client')
            .maybeSingle();

        if (roleErr) {
            return NextResponse.json({ok: false, error: roleErr.message}, {status: 400});
        }
        if (!clientRole?.id) {
            return NextResponse.json({ok: false, error: 'client role not found'}, {status: 400});
        }

        // удаляем все роли по этому бизнесу, КРОМЕ client
        const {error: delErr} = await admin
            .from('user_roles')
            .delete()
            .eq('user_id', user_id)
            .eq('biz_id', biz_id)
            .neq('role_id', clientRole.id);

        if (delErr) {
            return NextResponse.json({ok: false, error: delErr.message}, {status: 400});
        }

        // гарантируем наличие client (idемпотентно)
        const {error: upsertErr} = await admin
            .from('user_roles')
            .upsert(
                {user_id, biz_id, role_id: clientRole.id},
                {onConflict: 'user_id,role_id,biz_id'} // порядок колонок должен соответствовать уникальному индексу/констрейну
            );

        if (upsertErr) {
            // дружелюбный хинт, если не хватает индекса
            const hint =
                /ON CONFLICT|unique|constraint/i.test(upsertErr.message)
                    ? `${upsertErr.message}. Убедись, что созданы индексы:
• CREATE UNIQUE INDEX IF NOT EXISTS user_roles_global_uniq ON public.user_roles (user_id, role_id) WHERE biz_id IS NULL;
• CREATE UNIQUE INDEX IF NOT EXISTS user_roles_per_biz_uniq ON public.user_roles (user_id, role_id, biz_id) WHERE biz_id IS NOT NULL;`
                    : upsertErr.message;
            return NextResponse.json({ok: false, error: hint}, {status: 400});
        }

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        logError('AdminMembersDemote', 'Failed to demote business member', e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
