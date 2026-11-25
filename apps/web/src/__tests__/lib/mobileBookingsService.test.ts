import { cancelMobileBooking, getMobileBookingDetails, listMobileBookings } from '@/lib/mobileBookingsService';

describe('mobileBookingsService', () => {
    test('maps booking list rows to client dto items', async () => {
        const limit = jest.fn().mockResolvedValue({
            data: [
                {
                    id: 'booking-1',
                    start_at: '2026-03-27T10:00:00Z',
                    end_at: '2026-03-27T11:00:00Z',
                    status: 'confirmed',
                    service: { name_ru: 'Массаж' },
                    staff: { full_name: 'Master' },
                    branch: { name: 'Branch', address: 'Addr' },
                    business: { name: 'Biz', slug: 'biz' },
                },
            ],
            error: null,
        });
        const order = jest.fn().mockReturnValue({ limit });
        const eq = jest.fn().mockReturnValue({ order });
        const select = jest.fn().mockReturnValue({ eq });

        const result = await listMobileBookings({
            client: { from: jest.fn().mockReturnValue({ select }) } as never,
            userId: 'user-1',
        });

        expect(result).toEqual({
            ok: true,
            data: [
                {
                    id: 'booking-1',
                    start_at: '2026-03-27T10:00:00Z',
                    end_at: '2026-03-27T11:00:00Z',
                    status: 'confirmed',
                    service: { name_ru: 'Массаж' },
                    staff: { full_name: 'Master' },
                    branch: { name: 'Branch', address: 'Addr' },
                    business: { name: 'Biz', slug: 'biz', tz: 'Asia/Bishkek' },
                },
            ],
        });
    });

    test('returns not_found when details row is absent', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: null,
            error: null,
        });
        const eqClient = { eq: jest.fn().mockReturnValue({ maybeSingle }) };
        const select = jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue(eqClient),
        });

        const result = await getMobileBookingDetails({
            client: { from: jest.fn().mockReturnValue({ select }) } as never,
            userId: 'user-1',
            bookingId: 'booking-1',
        });

        expect(result).toEqual({
            ok: false,
            error: 'not_found',
            message: 'Бронирование не найдено',
            status: 404,
        });
    });

    test('maps booking details row to client dto', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: {
                id: 'booking-1',
                start_at: '2026-03-27T10:00:00Z',
                end_at: '2026-03-27T11:00:00Z',
                status: 'confirmed',
                biz_id: 'biz-1',
                branch_id: 'branch-1',
                staff_id: 'staff-1',
                promotion_applied: null,
                subscription_applied: { plan_id: 'p' },
                service: { name_ru: 'Массаж', duration_min: 60, price_from: 1000, price_to: 1500 },
                staff: { full_name: 'Master' },
                branch: { name: 'Branch', address: 'Addr' },
                business: { name: 'Biz', slug: 'biz', phones: ['+996555123456'] },
            },
            error: null,
        });
        const secondEq = jest.fn().mockReturnValue({ maybeSingle });
        const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
        const select = jest.fn().mockReturnValue({ eq: firstEq });

        const result = await getMobileBookingDetails({
            client: { from: jest.fn().mockReturnValue({ select }) } as never,
            userId: 'user-1',
            bookingId: 'booking-1',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                id: 'booking-1',
                start_at: '2026-03-27T10:00:00Z',
                end_at: '2026-03-27T11:00:00Z',
                status: 'confirmed',
                // Reschedule needs the master's slots; a package booking is moved by the business.
                biz_id: 'biz-1',
                branch_id: 'branch-1',
                staff_id: 'staff-1',
                benefit_applied: true,
                service: {
                    name_ru: 'Массаж',
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 1500,
                },
                staff: { full_name: 'Master' },
                branch: { name: 'Branch', address: 'Addr' },
                business: { name: 'Biz', slug: 'biz', phones: ['+996555123456'], tz: 'Asia/Bishkek' },
            },
        });
    });

    test.each([
        ['Asia/Almaty', 'Asia/Almaty'],
        ['Europe/Moscow', 'Europe/Moscow'],
        [null, 'Asia/Bishkek'],
        ['', 'Asia/Bishkek'],
        ['Mars/Olympus', 'Asia/Bishkek'],
    ])('list returns the business time zone (ARCH-11): %p -> %p', async (tz, expected) => {
        const limit = jest.fn().mockResolvedValue({
            data: [{ id: 'b', start_at: 's', end_at: 'e', status: 'confirmed', service: null, staff: null, branch: null, business: [{ name: 'Biz', slug: 'biz', tz }] }],
            error: null,
        });
        const order = jest.fn().mockReturnValue({ limit });
        const eq = jest.fn().mockReturnValue({ order });
        const select = jest.fn().mockReturnValue({ eq });

        const result = await listMobileBookings({ client: { from: jest.fn().mockReturnValue({ select }) } as never, userId: 'user-1' });

        expect(select.mock.calls[0][0]).toContain('business:businesses(name,slug,tz)');
        expect(result.ok && result.data[0].business).toEqual({ name: 'Biz', slug: 'biz', tz: expected });
    });

    test.each([
        ['Asia/Almaty', 'Asia/Almaty'],
        ['Europe/Moscow', 'Europe/Moscow'],
        [undefined, 'Asia/Bishkek'],
        ['not a zone', 'Asia/Bishkek'],
    ])('details return the business time zone (ARCH-11): %p -> %p', async (tz, expected) => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: { id: 'b', start_at: 's', end_at: 'e', status: 'confirmed', service: null, staff: null, branch: null, business: { name: 'Biz', slug: 'biz', phones: null, tz } },
            error: null,
        });
        const secondEq = jest.fn().mockReturnValue({ maybeSingle });
        const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
        const select = jest.fn().mockReturnValue({ eq: firstEq });

        const result = await getMobileBookingDetails({
            client: { from: jest.fn().mockReturnValue({ select }) } as never,
            userId: 'user-1',
            bookingId: 'b',
        });

        expect(select.mock.calls[0][0]).toContain('business:businesses(name, slug, phones, tz)');
        expect(result.ok && result.data.business?.tz).toBe(expected);
    });

    test.each([
        [null, { ok: true }],
        [{ message: 'BOOKING_FINANCIAL_REVERSAL_REQUIRED' }, { ok: false, error: 'financial_reversal_required', status: 409 }],
        [{ message: 'BOOKING_NOT_FOUND' }, { ok: false, error: 'not_found', status: 404 }],
    ])('cancels only through checked RPC: %j', async (error, expected) => {
        const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'booking-1', status: 'confirmed' }, error: null }) };
        query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
        const from = jest.fn().mockReturnValue(query);
        const rpc = jest.fn().mockResolvedValue({ error });
        const result = await cancelMobileBooking({ client: { from, rpc } as never, userId: 'user-1', bookingId: 'booking-1' });
        expect(result).toMatchObject(expected);
        expect(rpc).toHaveBeenCalledWith('cancel_booking', { p_booking_id: 'booking-1' });
        expect(query.eq).toHaveBeenCalledWith('client_id', 'user-1');
        expect(from).toHaveBeenCalledTimes(1);
    });
});
