export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkCurrentUserIsSuperAdmin, type SuperAdminRoleClient } from '@/lib/adminAccess';
import {
    approveBusinessRoleApplication,
    normalizeBusinessRole,
    rejectBusinessRoleApplication,
} from '@/lib/businessRoleApplicationService';
import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

type Body = {
    action?: 'approve' | 'reject';
    note?: string | null;
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

    const admin = createSupabaseAdminClient();
    const { data: application, error: applicationError } = await admin
        .from('business_role_applications')
        .select('requested_role,status')
        .eq('id', applicationId)
        .maybeSingle();
    if (applicationError) {
        return Response.json({ ok: false, message: applicationError.message }, { status: 400 });
    }
    if (!application) {
        return Response.json({ ok: false, message: 'Заявка не найдена.' }, { status: 404 });
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null;
    if (body.action !== 'reject' && normalizeBusinessRole(application.requested_role) === 'staff') {
        return Response.json({
            ok: false,
            message: 'Заявку сотрудника принимает владелец бизнеса с обязательным выбором филиала.',
        }, { status: 400 });
    }
    const result = body.action === 'reject'
        ? await rejectBusinessRoleApplication({ admin, applicationId, reviewerUserId: user.id, note })
        : await approveBusinessRoleApplication({ admin, applicationId, reviewerUserId: user.id, note });

    if (!result.ok) {
        return Response.json({ ok: false, message: result.message }, { status: result.status });
    }

    return Response.json({ ok: true });
}
