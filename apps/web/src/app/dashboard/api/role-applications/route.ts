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
            .select('id,applicant_user_id,biz_id,requested_role,status,applicant_name,applicant_email,applicant_phone,message,evidence_links,prior_submission_count,risk_flags,created_at,reviewed_at,review_note')
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

    const applications = applicationsResult.data ?? [];
    const userIds = [...new Set(applications.map((item) => item.applicant_user_id).filter(Boolean))];
    let blocks: Array<{ id: string; subject_user_id: string }> = [];
    if (userIds.length) {
        const { data: blockRows, error: blockError } = await admin
            .from('application_submission_blocks')
            .select('id,subject_user_id')
            .eq('application_kind', 'staff')
            .eq('biz_id', bizId)
            .in('subject_user_id', userIds)
            .gt('blocked_until', new Date().toISOString())
            .is('released_at', null);
        if (blockError) return Response.json({ ok: false, message: blockError.message }, { status: 400 });
        blocks = blockRows ?? [];
    }

    return Response.json({
        ok: true,
        items: applications.map((item) => ({
            ...item,
            active_block_id: blocks.find((block) => block.subject_user_id === item.applicant_user_id)?.id ?? null,
        })),
        branches: branchesResult.data ?? [],
    });
}
