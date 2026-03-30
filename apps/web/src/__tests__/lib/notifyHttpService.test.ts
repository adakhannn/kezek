jest.mock('@/lib/notifyBookingService', () => ({
    runNotifyBooking: jest.fn(),
}));

jest.mock('@/lib/validation/apiValidation', () => ({
    validateRequest: jest.fn(),
}));

import { runNotifyHttp } from '@/lib/notifyHttpService';
import { runNotifyBooking } from '@/lib/notifyBookingService';
import { validateRequest } from '@/lib/validation/apiValidation';

describe('notifyHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates validated request to notify service', async () => {
        (validateRequest as jest.Mock).mockResolvedValue({
            success: true,
            data: { type: 'hold', booking_id: 'booking-id' },
        });
        (runNotifyBooking as jest.Mock).mockResolvedValue({
            ok: true,
            data: { sent: 1, whatsappSent: 0, telegramSent: 0 },
        });

        const response = await runNotifyHttp(
            new Request('http://localhost/api/notify', { method: 'POST', body: '{}' }),
        );
        const body = await response.json();

        expect(runNotifyBooking).toHaveBeenCalledWith({ type: 'hold', booking_id: 'booking-id' });
        expect(response.status).toBe(200);
        expect(body.data.sent).toBe(1);
    });
});
