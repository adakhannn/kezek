import { logDebug, logError } from '@/lib/log';

export async function notify(type: 'hold' | 'confirm' | 'cancel', bookingId: string) {
    try {
        logDebug('DashboardNotify', 'Calling notify API', { type, bookingId });
        const response = await fetch('/api/notify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type, booking_id: bookingId }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            logError('DashboardNotify', 'Notify API error', {
                type,
                bookingId,
                status: response.status,
                error: errorText,
            });
        } else {
            const result = await response.json().catch(() => ({}));
            logDebug('DashboardNotify', 'Notify API success', { type, bookingId, result });
        }
    } catch (e) {
        logError('DashboardNotify', 'Notify API exception', { type, bookingId, error: e });
    }
}

