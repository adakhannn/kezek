import { logWarn } from './log';
import { isBusinessOwner } from './staffApplicationApprovalService';
import { createSupabaseAdminClient } from './supabaseHelpers';

export type StaffApplicationSummary = { pending: number | null } | null;

// Only call after resolving the authenticated, selected business context.
export async function loadStaffApplicationSummary(userId: string, bizId: string): Promise<StaffApplicationSummary> {
    try {
        const admin = createSupabaseAdminClient();
        if (!await isBusinessOwner({ admin, userId, bizId })) return null;
        const { count, error } = await admin.from('business_role_applications')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', bizId).eq('requested_role', 'staff').eq('status', 'pending');
        if (error) {
            logWarn('StaffApplicationSummary', 'Count unavailable', { code: error.code });
            return { pending: null };
        }
        return { pending: count ?? 0 };
    } catch {
        logWarn('StaffApplicationSummary', 'Could not resolve application access');
        return null;
    }
}
