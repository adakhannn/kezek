jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseAdminClient: jest.fn(() => ({ kind: 'admin' })),
}));

jest.mock('@/lib/bookingCancelRouteService', () => ({
    runBookingCancelRoute: jest.fn(),
}));

jest.mock('@/lib/businessManagerAccess', () => ({ managerAccessToBusiness: jest.fn() }));

import { managerAccessToBusiness } from '@/lib/businessManagerAccess';
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
    test('the cookie session keeps the website\'s business-context check', async () => {
        (runBookingCancelRoute as jest.Mock).mockResolvedValue({ ok: true });
        await runBookingCancelHttp(new Request('http://localhost/api/bookings/booking-id/cancel', { method: 'POST' }), {});
        expect(createSupabaseServerClient).toHaveBeenCalled();
        expect(jest.mocked(runBookingCancelRoute).mock.calls[0][0].isBusinessManager).toBeUndefined();
    });

    test('a Bearer token (the app) acts as that user and checks management of the booking\'s business (O1)', async () => {
        (runBookingCancelRoute as jest.Mock).mockResolvedValue({ ok: true });
        jest.mocked(managerAccessToBusiness).mockResolvedValueOnce('manager').mockResolvedValueOnce('none');
        const response = await runBookingCancelHttp(new Request('http://localhost/api/bookings/booking-id/cancel', {
            method: 'POST', headers: { Authorization: 'Bearer app-token' },
        }), {});
        expect(response.status).toBe(200);
        expect(createSupabaseServerClient).not.toHaveBeenCalled();
        const { isBusinessManager } = jest.mocked(runBookingCancelRoute).mock.calls[0][0];
        await expect(isBusinessManager!('user-1', 'biz-1')).resolves.toBe(true);
        await expect(isBusinessManager!('user-1', 'biz-2')).resolves.toBe(false);
        expect(managerAccessToBusiness).toHaveBeenCalledWith({ kind: 'admin' }, 'user-1', 'biz-1');
    });

    test('financial conflict remains HTTP409 rather than a successful cancellation', async () => {
        (runBookingCancelRoute as jest.Mock).mockResolvedValue({ ok: false, status: 409,
            error: 'financial_reversal_required', message: 'Требуется финансовый возврат' });
        const response = await runBookingCancelHttp(new Request('http://localhost/api/bookings/booking-id/cancel', { method: 'POST' }), {});
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ ok: false });
    });
});
