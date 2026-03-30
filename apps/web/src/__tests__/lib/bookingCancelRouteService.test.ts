import { runBookingCancelRoute } from '@/lib/bookingCancelRouteService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/authCheck', () => ({
    checkBookingBelongsToBusiness: jest.fn(),
}));

jest.mock('@/lib/serverCancelBookingService', () => ({
    runServerCancelBooking: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { runServerCancelBooking } from '@/lib/serverCancelBookingService';

describe('bookingCancelRouteService', () => {
    const mockSupabase = {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns not_found when booking does not exist', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        });
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });

        const result = await runBookingCancelRoute({
            supabase: mockSupabase as never,
            bookingId: 'booking-1',
            requestUrl: 'http://localhost/api/bookings/booking-1/cancel',
        });

        expect(result).toEqual({
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Бронирование не найдено',
        });
    });

    test('cancels client owned booking and sends notify callback', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: {
                    id: 'booking-1',
                    client_id: 'user-1',
                    status: 'confirmed',
                },
                error: null,
            }),
        });
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });

        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({ ok: true }),
        });

        (runServerCancelBooking as jest.Mock).mockImplementation(async (deps) => {
            await deps.notify?.({ bookingId: 'booking-1', type: 'cancel' });
        });

        const result = await runBookingCancelRoute({
            supabase: mockSupabase as never,
            bookingId: 'booking-1',
            requestUrl: 'http://localhost/api/bookings/booking-1/cancel',
            fetchImpl: fetchImpl as never,
        });

        expect(result).toEqual({ ok: true });
        expect(runServerCancelBooking).toHaveBeenCalledWith(
            expect.objectContaining({
                supabase: mockSupabase,
                clientId: 'user-1',
                notify: expect.any(Function),
            }),
            'booking-1',
        );
        expect(fetchImpl).toHaveBeenCalledWith(
            new URL('/api/notify', 'http://localhost/api/bookings/booking-1/cancel'),
            expect.objectContaining({
                method: 'POST',
            }),
        );
    });

    test('allows manager access when booking belongs to manager business', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: {
                    id: 'booking-1',
                    client_id: 'client-1',
                    status: 'confirmed',
                },
                error: null,
            }),
        });
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'manager-1' } },
            error: null,
        });
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-1' });
        (checkBookingBelongsToBusiness as jest.Mock).mockResolvedValue({ belongs: true });
        (runServerCancelBooking as jest.Mock).mockResolvedValue(undefined);

        const result = await runBookingCancelRoute({
            supabase: mockSupabase as never,
            bookingId: 'booking-1',
            requestUrl: 'http://localhost/api/bookings/booking-1/cancel',
        });

        expect(result).toEqual({ ok: true });
        expect(getBizContextForManagers).toHaveBeenCalled();
        expect(checkBookingBelongsToBusiness).toHaveBeenCalledWith('booking-1', 'biz-1');
    });
});
