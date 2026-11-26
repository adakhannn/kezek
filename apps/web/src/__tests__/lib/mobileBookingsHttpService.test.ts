import {
    runCancelMobileBookingHttp,
    runGetMobileBookingDetailsHttp,
    runListMobileBookingsHttp,
} from '@/lib/mobileBookingsHttpService';

jest.mock('@/lib/mobileBookingAuthService', () => ({
    resolveMobileBookingAuth: jest.fn(),
}));

jest.mock('@/lib/mobileBookingsService', () => ({
    listMobileBookings: jest.fn(),
    getMobileBookingDetails: jest.fn(),
    cancelMobileBooking: jest.fn(),
    parseMobileBookingsPage: jest.requireActual('@/lib/mobileBookingsService').parseMobileBookingsPage,
}));

jest.mock('@/lib/businessManagerAccess', () => ({
    managerAccessToBusiness: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseAdminClient: jest.fn(() => ({ kind: 'admin' })),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

import { resolveMobileBookingAuth } from '@/lib/mobileBookingAuthService';
import { managerAccessToBusiness } from '@/lib/businessManagerAccess';
import { cancelMobileBooking, getMobileBookingDetails, listMobileBookings } from '@/lib/mobileBookingsService';
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
            limit: 50,
            offset: 0,
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
            isBusinessManager: expect.any(Function),
        });
        expect(response.status).toBe(200);
        expect(body.data).toEqual({ id: 'booking-1' });
    });

    test('B11: passes the page parameters and returns the page info', async () => {
        (resolveMobileBookingAuth as jest.Mock).mockResolvedValue({ ok: true, client: { from: jest.fn() }, user: { id: 'user-1' } });
        (listMobileBookings as jest.Mock).mockResolvedValue({
            ok: true,
            data: [],
            page: { offset: 20, limit: 20, has_more: false, next_offset: null },
        });

        const response = await runListMobileBookingsHttp(new Request('http://localhost/api/mobile/bookings?limit=20&offset=20'));
        const body = await response.json();

        expect(listMobileBookings).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 20 }));
        expect(body.page).toEqual({ offset: 20, limit: 20, has_more: false, next_offset: null });
    });

    test('B1: the manager check asks businessManagerAccess for the caller in the booking’s business', async () => {
        (resolveMobileBookingAuth as jest.Mock).mockResolvedValue({ ok: true, client: { from: jest.fn() }, user: { id: 'manager-1' } });
        (getRouteParamUuid as jest.Mock).mockResolvedValue('booking-1');
        (getMobileBookingDetails as jest.Mock).mockImplementation(async ({ isBusinessManager }) => ({
            ok: true,
            data: { id: 'booking-1', viewer_role: (await isBusinessManager('biz-1')) ? 'manager' : 'none' },
        }));
        (managerAccessToBusiness as jest.Mock).mockResolvedValue('manager');

        const response = await runGetMobileBookingDetailsHttp(new Request('http://localhost/api/mobile/bookings/booking-1'), {});
        const body = await response.json();

        expect(managerAccessToBusiness).toHaveBeenCalledWith({ kind: 'admin' }, 'manager-1', 'biz-1');
        expect(body.data.viewer_role).toBe('manager');

        (managerAccessToBusiness as jest.Mock).mockResolvedValue('none');
        const denied = await (await runGetMobileBookingDetailsHttp(new Request('http://localhost/api/mobile/bookings/booking-1'), {})).json();
        expect(denied.data.viewer_role).toBe('none');
    });

    test('cancels mobile booking after auth + route param resolution', async () => {
        (resolveMobileBookingAuth as jest.Mock).mockResolvedValue({
            ok: true,
            client: { from: jest.fn() },
            user: { id: 'user-1' },
        });
        (getRouteParamUuid as jest.Mock).mockResolvedValue('booking-1');
        (cancelMobileBooking as jest.Mock).mockResolvedValue({
            ok: true,
        });

        const response = await runCancelMobileBookingHttp(
            new Request('http://localhost/api/mobile/bookings/booking-1', { method: 'POST' }),
            { params: { id: 'booking-1' } },
        );
        const body = await response.json();

        expect(cancelMobileBooking).toHaveBeenCalledWith({
            client: { from: expect.any(Function) },
            userId: 'user-1',
            bookingId: 'booking-1',
        });
        expect(response.status).toBe(200);
        expect(body.data).toEqual({ alreadyCancelled: false });
    });
});
