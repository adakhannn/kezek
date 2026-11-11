jest.mock('@/lib/notifyBookingService', () => ({
    runNotifyBooking: jest.fn(),
}));

jest.mock('@/lib/validation/apiValidation', () => ({
    validateRequest: jest.fn(),
}));

import { runNotifyHttp } from '@/lib/notifyHttpService';
import { runNotifyBooking } from '@/lib/notifyBookingService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
jest.mock('@/lib/requestAuthContext', () => ({ resolveRequestAuthContext: jest.fn() }));

describe('notifyHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(resolveRequestAuthContext).mockResolvedValue({ supabase: { verified: true }, user: { id: 'user' } } as never);
    });

    test('delegates validated request to notify service', async () => {
        (validateRequest as jest.Mock).mockResolvedValue({
            success: true,
            data: { type: 'hold', booking_id: 'booking-id' },
        });
        (runNotifyBooking as jest.Mock).mockResolvedValue({
            ok: true,
            data: { queued: true, event_id: 'event-id' },
        });

        const response = await runNotifyHttp(
            new Request('http://localhost/api/notify', { method: 'POST', body: '{}' }),
        );
        const body = await response.json();

        expect(runNotifyBooking).toHaveBeenCalledWith({ type: 'hold', booking_id: 'booking-id' }, { verified: true });
        expect(response.status).toBe(200);
        expect(body.data).toEqual({ queued: true, event_id: 'event-id' });
    });
});
