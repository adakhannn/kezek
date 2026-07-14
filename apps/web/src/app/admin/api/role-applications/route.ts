export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkCurrentUserIsSuperAdmin, type SuperAdminRoleClient } from '@/lib/adminAccess';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const status = (url.searchParams.get('status') ?? '').trim();
    const admin = createSupabaseAdminClient();

    let query = admin
        .from('business_role_applications')
        .select('id,applicant_user_id,biz_id,requested_role,status,applicant_name,applicant_email,applicant_phone,message,created_at,reviewed_at,review_note,businesses(name,slug)')
        .order('created_at', { ascending: false })
        .limit(200);

    if (status && status !== 'all') {
        query = query.eq('status', status);
    }

    const { data, error: listError } = await query;
    if (listError) {
        return Response.json({ ok: false, message: listError.message }, { status: 400 });
    }

    return Response.json({ ok: true, items: data ?? [] });
}
