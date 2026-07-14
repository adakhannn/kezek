export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getBizContextForManagers } from '@/lib/authBiz';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

export async function GET() {
    const { bizId } = await getBizContextForManagers();
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
        .from('business_role_applications')
        .select('id,applicant_user_id,biz_id,requested_role,status,applicant_name,applicant_email,applicant_phone,message,created_at,reviewed_at,review_note')
        .eq('biz_id', bizId)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        return Response.json({ ok: false, message: error.message }, { status: 400 });
    }

    return Response.json({ ok: true, items: data ?? [] });
}
