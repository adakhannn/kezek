export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { releaseApplicationBlock } from '@/lib/applicationPolicy';
import { getBizContextForManagers } from '@/lib/authBiz';
import { notifyStaffApplicationApproved } from '@/lib/businessRoleApplicationNotificationService';
import {
    normalizeBusinessRole,
    rejectBusinessRoleApplication,
} from '@/lib/businessRoleApplicationService';
import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import {
    approveStaffApplication,
    isBusinessOwner,
} from '@/lib/staffApplicationApprovalService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

type Body = {
    action?: 'approve' | 'reject' | 'unblock';
    note?: string | null;
    branch_id?: unknown;
    is_active?: unknown;
    block_days?: unknown;
    block_id?: unknown;
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

    if (body.action !== 'approve' && body.action !== 'reject' && body.action !== 'unblock') {
        return Response.json({ ok: false, message: 'Неизвестное действие.' }, { status: 400 });
    }

    const reviewerIsOwner = await isBusinessOwner({ admin, userId, bizId });
    if (!reviewerIsOwner) {
        return Response.json({
            ok: false,
            message: 'Принимать и отклонять заявки сотрудников может только владелец бизнеса.',
        }, { status: 403 });
    }

    const { data: application, error: applicationError } = await admin
        .from('business_role_applications')
        .select('id,biz_id,requested_role,status,applicant_user_id')
        .eq('id', applicationId)
        .maybeSingle();
    if (applicationError) {
        return Response.json({ ok: false, message: applicationError.message }, { status: 400 });
    }
    if (!application || application.biz_id !== bizId) {
        return Response.json({ ok: false, message: 'Заявка не найдена.' }, { status: 404 });
    }

    const requestedRole = normalizeBusinessRole(application.requested_role);
    if (requestedRole !== 'staff') {
        return Response.json({
            ok: false,
            message: 'В кабинете владельца обрабатываются только заявки сотрудников.',
        }, { status: 403 });
    }

    if (body.action === 'unblock') {
        const blockId = typeof body.block_id === 'string' ? body.block_id : '';
        const { data: block } = await admin
            .from('application_submission_blocks')
            .select('id')
            .eq('id', blockId)
            .eq('subject_user_id', application.applicant_user_id)
            .eq('application_kind', 'staff')
            .eq('biz_id', bizId)
            .maybeSingle();
        if (!block) return Response.json({ ok: false, message: 'Блокировка не найдена.' }, { status: 404 });
        const result = await releaseApplicationBlock({
            admin,
            blockId,
            applicationId,
            reviewerUserId: userId,
        });
        if (!result.ok) return Response.json({ ok: false, message: result.message }, { status: result.status });
        return Response.json({ ok: true });
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null;
    const blockDays = typeof body.block_days === 'number' && [0, 7, 30, 90].includes(body.block_days)
        ? body.block_days
        : 0;
    if (body.action === 'reject') {
        const result = await rejectBusinessRoleApplication({
            admin,
            applicationId,
            reviewerUserId: userId,
            note,
            blockDays,
        });
        if (!result.ok) {
            return Response.json({ ok: false, message: result.message }, { status: result.status });
        }
        return Response.json({ ok: true });
    }

    const branchId = typeof body.branch_id === 'string' ? body.branch_id.trim() : '';
    if (!branchId) {
        return Response.json({
            ok: false,
            message: 'Перед принятием сотрудника выберите филиал.',
        }, { status: 400 });
    }

    const result = await approveStaffApplication({
        admin,
        applicationId,
        reviewerUserId: userId,
        branchId,
        isActive: body.is_active !== false,
    });
    if (!result.ok) {
        return Response.json({ ok: false, message: result.message }, { status: result.status });
    }

    if (application.applicant_user_id) {
        try {
            await notifyStaffApplicationApproved(admin, {
                applicantUserId: application.applicant_user_id,
                businessId: application.biz_id,
                origin: new URL(request.url).origin,
            });
        } catch (notificationError) {
            logError('ApplicationNotification', 'Approved staff application notification failed', notificationError);
        }
    }

    return Response.json({
        ok: true,
        staff_id: result.staffId,
        schedule_initialized: result.schedule.initialized,
        schedule_days_created: result.schedule.daysCreated,
        schedule_error: result.schedule.error,
    });
}
