import type { SupabaseClient } from '@supabase/supabase-js';

import { notifyStaffInvitationCreated } from '@/lib/businessRoleApplicationNotificationService';
import { logWarn } from '@/lib/log';

/**
 * Tells the invited person about a new invitation (API-06), with the business and branch names. Only
 * for an invitation just created, not for a reused pending one. Never fails the invitation: any
 * lookup or delivery failure is logged and swallowed.
 */
export async function notifyNewStaffInvitation(
    admin: SupabaseClient,
    { bizId, branchId, invitedUserId }: { bizId: string; branchId: string | null; invitedUserId: string },
): Promise<void> {
    try {
        const [business, branch] = await Promise.all([
            admin.from('businesses').select('name').eq('id', bizId).maybeSingle(),
            branchId
                ? admin.from('branches').select('name').eq('id', branchId).eq('biz_id', bizId).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
        ]);
        if (business.error) {
            logWarn('StaffInvitationNotification', 'Business lookup failed', { message: business.error.message });
        }
        const businessName = (business.data as { name?: string | null } | null)?.name ?? '';
        const branchName = (branch.data as { name?: string | null } | null)?.name ?? null;
        await notifyStaffInvitationCreated(admin, { invitedUserId, businessName, branchName });
    } catch (error) {
        logWarn('StaffInvitationNotification', 'Staff invitation notification failed', error);
    }
}
