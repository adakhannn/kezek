import { dispatchBookingNotification } from '@/lib/bookingNotificationDispatch';
import { logDebug, logError } from '@/lib/log';
import { runNotifyBooking } from '@/lib/notifyBookingService';

jest.mock('@/lib/notifyBookingService', () => ({ runNotifyBooking: jest.fn() }));
jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logError: jest.fn() }));

describe('in-request booking notification dispatch', () => {
    const client = { auth: { getUser: jest.fn() } } as never;
    beforeEach(() => jest.clearAllMocks());

    test('retains the request client rather than issuing an HTTP self-fetch', async () => {
        (runNotifyBooking as jest.Mock).mockResolvedValue({ ok: true, data: { sent: 0, telegramSent: 1, whatsappSent: 0 } });
        await dispatchBookingNotification(client, 'booking-id', 'confirm');
        expect(runNotifyBooking).toHaveBeenCalledWith({ booking_id: 'booking-id', type: 'confirm' }, client);
        expect(logDebug).toHaveBeenCalledWith('BookingNotificationDispatch', 'Notification dispatch completed', expect.objectContaining({ telegramSent: 1 }));
        expect(logError).not.toHaveBeenCalled();
    });

    test.each([401, 403])('reports rejection %i without claiming delivery or undoing booking', async status => {
        (runNotifyBooking as jest.Mock).mockResolvedValue({ ok: false, status, error: 'forbidden' });
        await expect(dispatchBookingNotification(client, 'booking-id', 'cancel')).resolves.toBeUndefined();
        expect(logError).toHaveBeenCalledWith('BookingNotificationDispatch', 'Notification rejected', expect.objectContaining({ status }));
        expect(logDebug).not.toHaveBeenCalled();
    });

    test('delivery exception does not invalidate the committed command', async () => {
        (runNotifyBooking as jest.Mock).mockRejectedValue(new Error('Provider down'));
        await expect(dispatchBookingNotification(client, 'booking-id', 'confirm')).resolves.toBeUndefined();
        expect(logError).toHaveBeenCalledWith('BookingNotificationDispatch', 'Notification dispatch failed', expect.any(Object));
        expect(logDebug).not.toHaveBeenCalled();
    });
});
