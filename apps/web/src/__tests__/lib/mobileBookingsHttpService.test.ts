import { runGetMobileBookingDetailsHttp, runListMobileBookingsHttp } from '@/lib/mobileBookingsHttpService';

jest.mock('@/lib/mobileBookingAuthService', () => ({
    resolveMobileBookingAuth: jest.fn(),
}));

jest.mock('@/lib/mobileBookingsService', () => ({
    listMobileBookings: jest.fn(),
    getMobileBookingDetails: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

import { resolveMobileBookingAuth } from '@/lib/mobileBookingAuthService';
import { getMobileBookingDetails, listMobileBookings } from '@/lib/mobileBookingsService';
import { getRouteParamUuid } from '@/lib/routeParams';

describe('mobileBookingsHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('lists mobile bookings after auth resolution', async () => {
        (resolveMobileBookingAuth as jest.Mock).mockResolvedValue({
            ok: true,
            client: { from: jest.fn() },
            user: { id: 'user-1' },
        });
        (listMobileBookings as jest.Mock).mockResolvedValue({
            ok: true,
            data: [{ id: 'booking-1' }],
        });

        const response = await runListMobileBookingsHttp(new Request('http://localhost/api/mobile/bookings'));
        const body = await response.json();

        expect(listMobileBookings).toHaveBeenCalledWith({
            client: { from: expect.any(Function) },
            userId: 'user-1',
        });
        expect(response.status).toBe(200);
        expect(body.data).toEqual([{ id: 'booking-1' }]);
    });

    test('loads mobile booking details after auth + route param resolution', async () => {
        (resolveMobileBookingAuth as jest.Mock).mockResolvedValue({
            ok: true,
            client: { from: jest.fn() },
            user: { id: 'user-1' },
        });
        (getRouteParamUuid as jest.Mock).mockResolvedValue('booking-1');
        (getMobileBookingDetails as jest.Mock).mockResolvedValue({
            ok: true,
            data: { id: 'booking-1' },
        });

        const response = await runGetMobileBookingDetailsHttp(
            new Request('http://localhost/api/mobile/bookings/booking-1'),
            { params: { id: 'booking-1' } },
        );
        const body = await response.json();

        expect(getMobileBookingDetails).toHaveBeenCalledWith({
            client: { from: expect.any(Function) },
            userId: 'user-1',
            bookingId: 'booking-1',
        });
        expect(response.status).toBe(200);
        expect(body.data).toEqual({ id: 'booking-1' });
    });
});
