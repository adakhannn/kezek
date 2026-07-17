export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getBizContextForManagers } from '@/lib/authBiz';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

export async function GET() {
    const { bizId } = await getBizContextForManagers();
    const admin = createSupabaseAdminClient();

    const [applicationsResult, branchesResult] = await Promise.all([
        admin
            .from('business_role_applications')
            .select('id,applicant_user_id,biz_id,requested_role,status,applicant_name,applicant_email,applicant_phone,message,created_at,reviewed_at,review_note')
            .eq('biz_id', bizId)
            .eq('requested_role', 'staff')
            .order('created_at', { ascending: false })
            .limit(100),
        admin
            .from('branches')
            .select('id,name,address,is_active')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name', { ascending: true }),
    ]);

    if (applicationsResult.error) {
        return Response.json({ ok: false, message: applicationsResult.error.message }, { status: 400 });
    }
    if (branchesResult.error) {
        return Response.json({ ok: false, message: branchesResult.error.message }, { status: 400 });
    }

    return Response.json({
        ok: true,
        items: applicationsResult.data ?? [],
        branches: branchesResult.data ?? [],
    });
}
