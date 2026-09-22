export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkCurrentUserIsSuperAdmin, type SuperAdminRoleClient } from '@/lib/adminAccess';
import { releaseApplicationBlock } from '@/lib/applicationPolicy';
import { notifyOwnerApplicationApproved } from '@/lib/businessRoleApplicationNotificationService';
import {
    approveBusinessRoleApplication,
    normalizeBusinessRole,
    rejectBusinessRoleApplication,
} from '@/lib/businessRoleApplicationService';
import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

type Body = {
    action?: 'approve' | 'reject' | 'unblock';
    note?: string | null;
    block_days?: unknown;
    block_id?: unknown;
};

export async function POST(request: Request, context: unknown) {
    const applicationId = await getRouteParamRequired(context, 'id');
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return Response.json({ ok: false, message: 'auth' }, { status: 401 });
    }

    const { isSuperAdmin, error } = await checkCurrentUserIsSuperAdmin(
        supabase as unknown as SuperAdminRoleClient,
        user.id,
    );
    if (error || !isSuperAdmin) {
        return Response.json({ ok: false, message: 'forbidden' }, { status: 403 });
    }

    let body: Body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ ok: false, message: 'Неверный формат запроса.' }, { status: 400 });
    }

    if (body.action !== 'approve' && body.action !== 'reject' && body.action !== 'unblock') {
        return Response.json({ ok: false, message: 'Неизвестное действие.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: application, error: applicationError } = await admin
        .from('business_role_applications')
        .select('requested_role,status,applicant_user_id,biz_id')
        .eq('id', applicationId)
        .maybeSingle();
    if (applicationError) {
        return Response.json({ ok: false, message: applicationError.message }, { status: 400 });
    }
    if (!application) {
        return Response.json({ ok: false, message: 'Заявка не найдена.' }, { status: 404 });
    }
    if (body.action === 'unblock') {
        const blockId = typeof body.block_id === 'string' ? body.block_id : '';
        const { data: block } = await admin
            .from('application_submission_blocks')
            .select('id')
            .eq('id', blockId)
            .eq('subject_user_id', application.applicant_user_id)
            .eq('application_kind', application.requested_role)
            .or(`biz_id.is.null,biz_id.eq.${application.biz_id}`)
            .maybeSingle();
        if (!block) return Response.json({ ok: false, message: 'Блокировка не найдена.' }, { status: 404 });
        const result = await releaseApplicationBlock({
            admin,
            blockId,
            applicationId,
            reviewerUserId: user.id,
        });
        if (!result.ok) return Response.json({ ok: false, message: result.message }, { status: result.status });
        return Response.json({ ok: true });
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null;
    const blockDays = typeof body.block_days === 'number' && [0, 7, 30, 90].includes(body.block_days)
        ? body.block_days
        : 0;
    if (body.action !== 'reject' && normalizeBusinessRole(application.requested_role) === 'staff') {
        return Response.json({
            ok: false,
            message: 'Заявку сотрудника принимает владелец бизнеса с обязательным выбором филиала.',
        }, { status: 400 });
    }
    const result = body.action === 'reject'
        ? await rejectBusinessRoleApplication({
            admin,
            applicationId,
            reviewerUserId: user.id,
            note,
            blockDays,
        })
        : await approveBusinessRoleApplication({ admin, applicationId, reviewerUserId: user.id, note });

    if (!result.ok) {
        return Response.json({ ok: false, message: result.message }, { status: result.status });
    }

    if (body.action === 'approve' && normalizeBusinessRole(application.requested_role) === 'owner' && application.applicant_user_id) {
        try {
            await notifyOwnerApplicationApproved(admin, {
                applicantUserId: application.applicant_user_id,
                businessId: application.biz_id,
                origin: new URL(request.url).origin,
            });
        } catch (notificationError) {
            logError('ApplicationNotification', 'Approved owner application notification failed', notificationError);
        }
    }

    return Response.json({ ok: true });
}
