jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/bookingCancelRouteService', () => ({
    runBookingCancelRoute: jest.fn(),
}));

import { runBookingCancelHttp } from '@/lib/bookingCancelHttpService';
import { runBookingCancelRoute } from '@/lib/bookingCancelRouteService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

describe('bookingCancelHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getRouteParamUuid as jest.Mock).mockResolvedValue('booking-id');
        (createSupabaseServerClient as jest.Mock).mockResolvedValue({ auth: { getUser: jest.fn() }, from: jest.fn() });
    });

    test('delegates cancel request to booking cancel route service', async () => {
        (runBookingCancelRoute as jest.Mock).mockResolvedValue({ ok: true });

        const response = await runBookingCancelHttp(
            new Request('http://localhost/api/bookings/booking-id/cancel', { method: 'POST' }),
            { params: { id: 'booking-id' } },
        );
        const body = await response.json();

        expect(runBookingCancelRoute).toHaveBeenCalledWith({
            supabase: expect.any(Object),
            bookingId: 'booking-id',
        });
        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
    });
    test('financial conflict remains HTTP409 rather than a successful cancellation', async () => {
        (runBookingCancelRoute as jest.Mock).mockResolvedValue({ ok: false, status: 409,
            error: 'financial_reversal_required', message: 'Требуется финансовый возврат' });
        const response = await runBookingCancelHttp(new Request('http://localhost/api/bookings/booking-id/cancel', { method: 'POST' }), {});
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ ok: false });
    });
});
