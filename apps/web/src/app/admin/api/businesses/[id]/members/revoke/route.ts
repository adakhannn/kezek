// apps/web/src/app/admin/api/businesses/[id]/members/revoke/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { DATABASE_FAILURE_MESSAGES, publicErrorMessage, reportDatabaseError } from '@/lib/apiErrorHandler';
import {
    canAssignBusinessRole,
    canChangeBusinessMember,
    loadBusinessMemberRoleKeys,
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

        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        const actor = await resolveBusinessMemberActor(supa, biz_id);
        if (!actor) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        const body = (await req.json().catch(() => null)) as { user_id?: unknown; role_key?: unknown } | null;
        const user_id = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
        if (!isUuid(user_id)) return NextResponse.json({ ok: false, error: 'bad user_id' }, { status: 400 });
        const role_key = body?.role_key === undefined ? 'client' : parseBusinessMemberRoleKey(body.role_key);
        if (!role_key) return NextResponse.json({ ok: false, error: 'bad role_key' }, { status: 400 });
        if (!canAssignBusinessRole(actor, role_key)) {
            return NextResponse.json({ ok: false, error: 'forbidden_role' }, { status: 403 });
        }

        const admin = createSupabaseAdminClient();

        const targetRoles = await loadBusinessMemberRoleKeys(admin, biz_id, user_id);
        if (!targetRoles.ok) {
            logError('AdminMembersRevoke', 'Could not load the member roles', { bizId: biz_id });
            return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
        }
        if (!canChangeBusinessMember(actor, targetRoles.keys)) {
            return NextResponse.json({ ok: false, error: 'forbidden_member' }, { status: 403 });
        }

        const { data: roleRow, error: roleErr } = await admin
            .from('roles')
            .select('id')
            .eq('key', role_key)
            .maybeSingle();
        if (roleErr || !roleRow) {
            return NextResponse.json({ ok: false, error: 'role not found' }, { status: 400 });
        }

        const { error: delErr } = await admin
            .from('user_roles')
            .delete()
            .eq('user_id', user_id)
            .eq('role_id', roleRow.id)
            .eq('biz_id', biz_id);
        if (delErr) return NextResponse.json({ ok: false, error: reportDatabaseError('AdminMembersRevoke', delErr, DATABASE_FAILURE_MESSAGES.delete) }, { status: 400 });

        // если сняли owner — очистим owner_id у бизнеса (если это он)
        if (role_key === 'owner') {
            await admin
                .from('businesses')
                .update({ owner_id: null })
                .eq('id', biz_id)
                .eq('owner_id', user_id);
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        logError('AdminMembersRevoke', 'Failed to revoke business role', e);
        const msg = publicErrorMessage(e, DATABASE_FAILURE_MESSAGES.internal);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
