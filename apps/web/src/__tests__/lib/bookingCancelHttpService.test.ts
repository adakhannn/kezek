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
            requestUrl: 'http://localhost/api/bookings/booking-id/cancel',
        });
        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
    });
});
