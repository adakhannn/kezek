export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getBizContextForManagers } from '@/lib/authBiz';
import {
    approveBusinessRoleApplication,
    canBusinessManagerApproveRole,
    normalizeBusinessRole,
    rejectBusinessRoleApplication,
} from '@/lib/businessRoleApplicationService';
import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

type Body = {
    action?: 'approve' | 'reject';
    note?: string | null;
};

export async function POST(request: Request, context: unknown) {
    const applicationId = await getRouteParamRequired(context, 'id');
    const { bizId, userId } = await getBizContextForManagers();
    const admin = createSupabaseAdminClient();

    let body: Body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ ok: false, message: 'Неверный формат запроса.' }, { status: 400 });
    }

    const { data: application, error: applicationError } = await admin
        .from('business_role_applications')
        .select('id,biz_id,requested_role,status')
        .eq('id', applicationId)
        .maybeSingle();
    if (applicationError) {
        return Response.json({ ok: false, message: applicationError.message }, { status: 400 });
    }
    if (!application || application.biz_id !== bizId) {
        return Response.json({ ok: false, message: 'Заявка не найдена.' }, { status: 404 });
    }

    const requestedRole = normalizeBusinessRole(application.requested_role);
    if (!requestedRole || !canBusinessManagerApproveRole(requestedRole)) {
        return Response.json({
            ok: false,
            message: 'Заявки на владельца может обрабатывать только супер-админ.',
        }, { status: 403 });
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null;
    const result = body.action === 'reject'
        ? await rejectBusinessRoleApplication({ admin, applicationId, reviewerUserId: userId, note })
        : await approveBusinessRoleApplication({ admin, applicationId, reviewerUserId: userId, note });

    if (!result.ok) {
        return Response.json({ ok: false, message: result.message }, { status: result.status });
    }

    return Response.json({ ok: true });
}
