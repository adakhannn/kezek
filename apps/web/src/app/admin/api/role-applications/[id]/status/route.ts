export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkCurrentUserIsSuperAdmin, type SuperAdminRoleClient } from '@/lib/adminAccess';
import {
    approveBusinessRoleApplication,
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
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null;
    const result = body.action === 'reject'
        ? await rejectBusinessRoleApplication({ admin, applicationId, reviewerUserId: user.id, note })
        : await approveBusinessRoleApplication({ admin, applicationId, reviewerUserId: user.id, note });

    if (!result.ok) {
        return Response.json({ ok: false, message: result.message }, { status: result.status });
    }

    return Response.json({ ok: true });
}
