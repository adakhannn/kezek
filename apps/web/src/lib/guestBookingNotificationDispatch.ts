import { enqueueStoredBookingNotification } from '@/lib/notifyBookingService';
import type { QuickBookGuestInput } from '@/lib/quickBookGuestService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

/**
 * Private post-command adapter, not a public notification endpoint. The booking ID
 * comes from the successful guest RPC, never from a request notification payload.
 * Service access reads participants; it does not create or impersonate a session.
 */
export async function dispatchCreatedGuestBookingNotification(
    bookingId: string,
    type: 'hold' | 'confirm',
    command: QuickBookGuestInput,
): Promise<void> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('bookings')
        .select('id,status')
        .eq('id', bookingId)
        .eq('biz_id', command.biz_id)
        .eq('branch_id', command.branch_id)
        .eq('staff_id', command.staff_id)
        .eq('start_at', command.start_at)
        .in('status', type === 'confirm' ? ['confirmed'] : ['hold', 'pending_hold'])
        .is('client_id', null)
        .maybeSingle();
    if (error || !data) {
        throw new Error('Created guest booking notification scope mismatch');
    }
    await enqueueStoredBookingNotification(admin, bookingId, type);
}
