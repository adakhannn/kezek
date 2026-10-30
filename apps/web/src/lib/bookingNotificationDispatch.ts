import type { SupabaseClient } from '@supabase/supabase-js';

import { logDebug, logError } from '@/lib/log';
import { runNotifyBooking } from '@/lib/notifyBookingService';

/** Dispatch inside the request, retaining its identity rather than making an unauthenticated self-fetch. */
export async function dispatchBookingNotification(
    supabase: SupabaseClient,
    bookingId: string,
    type: 'hold' | 'confirm' | 'cancel',
): Promise<void> {
    try {
        const result = await runNotifyBooking({ booking_id: bookingId, type }, supabase);
        if (!result.ok) {
            logError('BookingNotificationDispatch', 'Notification rejected', {
                bookingId, type, status: result.status, error: result.error,
            });
            return;
        }
        logDebug('BookingNotificationDispatch', 'Notification dispatch completed', {
            bookingId, type, ...result.data,
        });
    } catch (error) {
        // A delivery failure must not roll back an already committed booking command.
        logError('BookingNotificationDispatch', 'Notification dispatch failed', { bookingId, type, error });
    }
}
