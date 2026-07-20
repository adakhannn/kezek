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
        .select('id,applicant_user_id,biz_id,requested_role,status,applicant_name,applicant_email,applicant_phone,message,evidence_links,prior_submission_count,risk_flags,created_at,reviewed_at,review_note,businesses(name,slug)')
        .order('created_at', { ascending: false })
        .limit(200);

    if (status && status !== 'all') {
        query = query.eq('status', status);
    }

    const { data, error: listError } = await query;
    if (listError) {
        return Response.json({ ok: false, message: listError.message }, { status: 400 });
    }

    const items = data ?? [];
    const userIds = [...new Set(items.map((item) => item.applicant_user_id).filter(Boolean))];
    let blocks: Array<{
        id: string;
        subject_user_id: string;
        biz_id: string | null;
        application_kind: string;
    }> = [];
    if (userIds.length) {
        const { data: blockRows, error: blockError } = await admin
            .from('application_submission_blocks')
            .select('id,subject_user_id,biz_id,application_kind')
            .in('subject_user_id', userIds)
            .in('application_kind', ['owner', 'staff'])
            .gt('blocked_until', new Date().toISOString())
            .is('released_at', null);
        if (blockError) return Response.json({ ok: false, message: blockError.message }, { status: 400 });
        blocks = blockRows ?? [];
    }

    return Response.json({
        ok: true,
        items: items.map((item) => ({
            ...item,
            active_block_id: blocks.find((block) => (
                block.subject_user_id === item.applicant_user_id
                && block.application_kind === item.requested_role
                && (block.biz_id === null || block.biz_id === item.biz_id)
            ))?.id ?? null,
        })),
    });
}
