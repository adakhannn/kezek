import { GET as GET_LIST } from '@/app/api/mobile/bookings/route';
import { GET as GET_DETAILS } from '@/app/api/mobile/bookings/[id]/route';
import {
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

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

describe('/api/mobile/bookings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns 401 when mobile auth fails', async () => {
        (resolveMobileBookingAuth as jest.Mock).mockResolvedValue({
            ok: false,
            error: 'auth',
            message: 'Not signed in',
            status: 401,
        });

        const res = await GET_LIST(createMockRequest('http://localhost/api/mobile/bookings', { method: 'GET' }));
        await expectErrorResponse(res, 401, 'auth');
    });

    test('returns bookings list', async () => {
        (resolveMobileBookingAuth as jest.Mock).mockResolvedValue({
            ok: true,
            client: { from: jest.fn() },
            user: { id: 'user-1' },
        });
        (listMobileBookings as jest.Mock).mockResolvedValue({
            ok: true,
            data: [{ id: 'booking-1' }],
        });

        const res = await GET_LIST(createMockRequest('http://localhost/api/mobile/bookings', { method: 'GET' }));
        const body = await expectSuccessResponse(res, 200);
        expect(body.data).toEqual([{ id: 'booking-1' }]);
    });
});

describe('/api/mobile/bookings/[id]', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns booking details', async () => {
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

        const res = await GET_DETAILS(
            createMockRequest('http://localhost/api/mobile/bookings/booking-1', { method: 'GET' }),
            { params: { id: 'booking-1' } },
        );
        const body = await expectSuccessResponse(res, 200);
        expect(body.data).toEqual({ id: 'booking-1' });
    });
});
