export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getRouteParamRequired } from '@/lib/routeParams';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function DELETE(_request: Request, context: unknown) {
    const applicationId = await getRouteParamRequired(context, 'id');
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ ok: false, message: 'Войдите в аккаунт.' }, { status: 401 });

    let admin;
    try {
        admin = createSupabaseAdminClient();
    } catch {
        return Response.json({ ok: false, message: 'Сервис заявок не настроен в этом окружении.' }, { status: 503 });
    }
    const { data: application, error: applicationError } = await admin
        .from('business_role_applications')
        .select('id,applicant_user_id,biz_id,requested_role,status')
        .eq('id', applicationId)
        .maybeSingle();
    if (applicationError) return Response.json({ ok: false, message: applicationError.message }, { status: 400 });
    if (!application || application.applicant_user_id !== user.id) {
        return Response.json({ ok: false, message: 'Заявка не найдена.' }, { status: 404 });
    }
    if (application.status !== 'pending') {
        return Response.json({ ok: false, message: 'Заявка уже обработана.' }, { status: 409 });
    }

    const { data: cancelled, error: cancelError } = await admin.rpc('cancel_business_role_application', {
        p_application_id: applicationId,
        p_user_id: user.id,
    });
    if (cancelError) return Response.json({ ok: false, message: cancelError.message }, { status: 400 });
    if (!cancelled) return Response.json({ ok: false, message: 'Заявка уже обработана.' }, { status: 409 });

    return Response.json({ ok: true });
}
