import type { BookingNotificationPort } from '@core-domain/booking';

import { logDebug, logError } from '@/lib/log';

type NotificationType = 'hold' | 'confirm' | 'cancel';

export function createBookingNotificationHttpAdapter(
    req: Request,
    source: string,
): BookingNotificationPort {
    return {
        async send(bookingId: string, type: NotificationType) {
            await notifyBookingViaHttp(req, source, bookingId, type);
        },
    };
}

async function notifyBookingViaHttp(
    req: Request,
    source: string,
    bookingId: string,
    type: NotificationType,
) {
    try {
        const notifyUrl = new URL('/api/notify', req.url);
        logDebug(source, 'Calling notify API', {
            url: notifyUrl.toString(),
            type,
            bookingId,
        });

        const response = await fetch(notifyUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type, booking_id: bookingId }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            logError(source, 'Notify API error', {
                status: response.status,
                errorText,
            });
            return;
        }

        const result = await response.json().catch(() => ({}));
        logDebug(source, 'Notify API success', result);
    } catch (error) {
        logError(source, 'Notify API exception', error);
    }
}
