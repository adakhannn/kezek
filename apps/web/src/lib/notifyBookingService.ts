import type { SupabaseClient } from '@supabase/supabase-js';

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { BookingDataService } from '@/lib/notifications/BookingDataService';
import type { NotifyType } from '@/lib/notifications/types';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

type NotifyBookingResult =
    | { ok: true; data: { queued: true; event_id: string } }
    | { ok: false; status: 401 | 403 | 404 | 409 | 503; error: string; message: string };

/** Trusted adapter; public callers must complete ownership checks first. */
export async function enqueueStoredBookingNotification(admin: SupabaseClient, bookingId: string, type: NotifyType): Promise<string> {
    const { data, error } = await admin.rpc('enqueue_booking_notification', { p_booking_id: bookingId, p_type: type });
    if (error) throw new Error(error.message === 'NOTIFICATION_STATE_MISMATCH' ? 'NOTIFICATION_STATE_MISMATCH' : 'NOTIFICATION_ENQUEUE_FAILED');
    if (typeof data !== 'string' || !data) throw new Error('NOTIFICATION_ENQUEUE_FAILED');
    return data;
}

export async function runNotifyBooking(
    { type, booking_id }: { type: NotifyType; booking_id: string },
    requestClient?: SupabaseClient,
): Promise<NotifyBookingResult> {
    const { supabase: cookieClient, admin } = await createSupabaseClients();
    const supabase = requestClient ?? cookieClient;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { ok: false, status: 401, error: 'auth', message: 'Не авторизован' };
    const booking = await new BookingDataService(admin).getBookingById(booking_id);
    if (!booking) return { ok: false, status: 404, error: 'not_found', message: 'Booking not found' };
    if (booking.client_id !== user.id) {
        try {
            const context = await getBizContextForManagers();
            // A cookie manager identity must never authorize a different bearer user.
            if (context.userId !== user.id || !(await checkBookingBelongsToBusiness(booking_id, context.bizId)).belongs) {
                return { ok: false, status: 403, error: 'forbidden', message: 'Доступ запрещен' };
            }
        } catch {
            return { ok: false, status: 403, error: 'forbidden', message: 'Доступ запрещен' };
        }
    }
    try {
        const eventId = await enqueueStoredBookingNotification(admin, booking_id, type);
        return { ok: true, data: { queued: true, event_id: eventId } };
    } catch (error) {
        const mismatch = error instanceof Error && error.message === 'NOTIFICATION_STATE_MISMATCH';
        return { ok: false, status: mismatch ? 409 : 503, error: mismatch ? 'notification_state_mismatch' : 'service_unavailable',
            message: mismatch ? 'Booking state changed' : 'Notification could not be queued' };
    }
}
