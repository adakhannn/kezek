import type { SupabaseClient } from '@supabase/supabase-js';

import { logDebug, logError } from '@/lib/log';
import { runNotifyBooking } from '@/lib/notifyBookingService';

/** Authorize and idempotently enqueue; delivery runs in the outbox worker. */
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
        logDebug('BookingNotificationDispatch', 'Notification queued', {
            bookingId, type, ...result.data,
        });
    } catch (error) {
        // Booking mutations already enqueue transactionally via the DB trigger.
        logError('BookingNotificationDispatch', 'Notification dispatch failed', { bookingId, type, error });
    }
}
