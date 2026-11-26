import {
    cancelMobileBooking,
    getMobileBookingDetails,
    listMobileBookings,
    mapAppliedPackage,
    mapAppliedPromotion,
    parseMobileBookingsPage,
} from '@/lib/mobileBookingsService';

const NOW = new Date('2026-03-28T00:00:00Z');

function listClient(rows: unknown[], error: unknown = null) {
    const range = jest.fn().mockResolvedValue({ data: rows, error });
    const secondOrder = jest.fn().mockReturnValue({ range });
    const order = jest.fn().mockReturnValue({ order: secondOrder });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    return { client: { from: jest.fn().mockReturnValue({ select }) } as never, select, eq, range };
}

function detailsClient(row: unknown, error: unknown = null) {
    const maybeSingle = jest.fn().mockResolvedValue({ data: row, error });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    return { client: { from: jest.fn().mockReturnValue({ select }) } as never, select, eq };
}

const baseDetailsRow = {
    id: 'booking-1',
    start_at: '2026-03-27T10:00:00Z',
    end_at: '2026-03-27T11:00:00Z',
    status: 'confirmed',
    biz_id: 'biz-1',
    branch_id: 'branch-1',
    staff_id: 'staff-1',
    client_id: 'user-1',
    client_name: 'Aida',
    promotion_applied: null,
    subscription_applied: { plan_id: 'p' },
    service: { name_ru: 'Массаж', duration_min: 60, price_from: 1000, price_to: 1500 },
    staff: { full_name: 'Master', user_id: 'master-user', is_active: true },
    branch: { name: 'Branch', address: 'Addr' },
    business: { name: 'Biz', slug: 'biz', phones: ['+996555123456'] },
};

describe('mobileBookingsService', () => {
    test('maps booking list rows to client dto items', async () => {
        const { client, eq, range } = listClient([
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
        ]);

        const result = await listMobileBookings({ client, userId: 'user-1', now: NOW });

        expect(eq).toHaveBeenCalledWith('client_id', 'user-1');
        // One row beyond the default page of 50 tells whether more exist.
        expect(range).toHaveBeenCalledWith(0, 50);
        expect(result).toEqual({
            ok: true,
            page: { offset: 0, limit: 50, has_more: false, next_offset: null },
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
                    promotion: null,
                    package: null,
                    review: null,
                    can_review: false,
                },
            ],
        });
    });

    test('B11: pages the history with offset and reports the next page', async () => {
        const rows = Array.from({ length: 3 }, (_, i) => ({
            id: `b-${i}`, start_at: 's', end_at: 'e', status: 'paid', service: null, staff: null, branch: null, business: null,
        }));
        const { client, range } = listClient(rows);

        const result = await listMobileBookings({ client, userId: 'user-1', limit: 2, offset: 4, now: NOW });

        expect(range).toHaveBeenCalledWith(4, 6);
        expect(result.ok && result.data.map((b) => b.id)).toEqual(['b-0', 'b-1']);
        expect(result.ok && result.page).toEqual({ offset: 4, limit: 2, has_more: true, next_offset: 6 });
    });

    test('list carries all services, the applied promotion or package, the review and the review rule (C11)', async () => {
        const { client } = listClient([
            {
                id: 'paid-visit',
                start_at: '2026-03-27T10:00:00Z',
                end_at: '2026-03-27T11:00:00Z',
                status: 'paid',
                promotion_applied: { promotion_title: 'Happy hour', discount_percent: '20', final_amount: 800 },
                subscription_applied: null,
                service: { name_ru: 'Стрижка' },
                booking_services: [
                    { order_index: 1, duration_min: 15, service: { name_ru: 'Укладка', name_ky: null, name_en: 'Styling', duration_min: 15 } },
                    { order_index: 0, duration_min: 45, service: { name_ru: 'Стрижка', duration_min: 40 } },
                ],
                staff: null,
                branch: null,
                business: null,
                reviews: [],
            },
            {
                id: 'reviewed',
                start_at: '2026-03-20T10:00:00Z',
                end_at: '2026-03-20T11:00:00Z',
                status: 'paid',
                subscription_applied: { plan_name_ru: '10 визитов', final_amount: 0 },
                service: null,
                staff: null,
                branch: null,
                business: null,
                reviews: { id: 'r-1', rating: 4, comment: 'ok' },
            },
            {
                id: 'future-paid',
                start_at: '2026-04-01T10:00:00Z',
                end_at: '2026-04-01T11:00:00Z',
                status: 'paid',
                service: null,
                staff: null,
                branch: null,
                business: null,
            },
        ]);

        const result = await listMobileBookings({ client, userId: 'user-1', now: NOW });
        if (!result.ok) throw new Error('expected ok');
        const [paid, reviewed, future] = result.data;

        expect(paid.services).toEqual([
            { name_ru: 'Стрижка', name_ky: null, name_en: null, duration_min: 45 },
            { name_ru: 'Укладка', name_ky: null, name_en: 'Styling', duration_min: 15 },
        ]);
        expect(paid.promotion).toEqual({ title: 'Happy hour', discount_percent: 20, final_amount: 800 });
        expect(paid.can_review).toBe(true);
        expect(reviewed.package).toEqual({ name: '10 визитов', final_amount: 0 });
        expect(reviewed.review).toEqual({ id: 'r-1', rating: 4, comment: 'ok' });
        expect(reviewed.can_review).toBe(false);
        // Not started yet: no review, as POST /api/reviews/create refuses it.
        expect(future.can_review).toBe(false);
        expect(future.services).toBeUndefined();
    });

    test('returns not_found when details row is absent', async () => {
        const { client } = detailsClient(null);

        const result = await getMobileBookingDetails({ client, userId: 'user-1', bookingId: 'booking-1' });

        expect(result).toEqual({
            ok: false,
            error: 'not_found',
            message: 'Бронирование не найдено',
            status: 404,
        });
    });

    test('maps booking details row to client dto', async () => {
        const { client, eq } = detailsClient(baseDetailsRow);

        const result = await getMobileBookingDetails({ client, userId: 'user-1', bookingId: 'booking-1', now: NOW });

        expect(eq).toHaveBeenCalledWith('id', 'booking-1');
        expect(result).toEqual({
            ok: true,
            data: {
                id: 'booking-1',
                start_at: '2026-03-27T10:00:00Z',
                end_at: '2026-03-27T11:00:00Z',
                status: 'confirmed',
                viewer_role: 'client',
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
                promotion: null,
                package: { name: null, final_amount: null },
                staff: { full_name: 'Master' },
                branch: { name: 'Branch', address: 'Addr', lat: null, lon: null },
                business: { name: 'Biz', slug: 'biz', phones: ['+996555123456'], tz: 'Asia/Bishkek' },
                review: null,
                can_review: false,
            },
        });
    });

    test('details carry branch coordinates for the map and the client review', async () => {
        const { client } = detailsClient({
            ...baseDetailsRow,
            status: 'paid',
            branch: { name: 'Branch', address: 'Addr', lat: 42.87, lon: '74.59' },
            reviews: { id: 'r-1', rating: 5, comment: null },
        });

        const result = await getMobileBookingDetails({ client, userId: 'user-1', bookingId: 'booking-1', now: NOW });

        expect(result.ok && result.data.branch).toEqual({ name: 'Branch', address: 'Addr', lat: 42.87, lon: 74.59 });
        expect(result.ok && result.data.review).toEqual({ id: 'r-1', rating: 5, comment: null });
        expect(result.ok && result.data.can_review).toBe(false);
    });

    describe('who reads the details (B1)', () => {
        test('the booking’s own active master gets the staff view: client name, no review, no client actions', async () => {
            const { client } = detailsClient({ ...baseDetailsRow, status: 'paid', reviews: { id: 'r-1', rating: 2, comment: 'private' } });
            const isBusinessManager = jest.fn();

            const result = await getMobileBookingDetails({ client, userId: 'master-user', bookingId: 'booking-1', isBusinessManager, now: NOW });

            if (!result.ok) throw new Error('expected ok');
            expect(result.data.viewer_role).toBe('staff');
            expect(result.data.client_name).toBe('Aida');
            expect(result.data.review).toBeUndefined();
            expect(result.data.can_review).toBe(false);
            expect(JSON.stringify(result.data)).not.toContain('client_phone');
            expect(JSON.stringify(result.data)).not.toContain('client_email');
            expect(isBusinessManager).not.toHaveBeenCalled();
        });

        test('a dismissed (inactive) master no longer reads the booking', async () => {
            const { client } = detailsClient({ ...baseDetailsRow, staff: { full_name: 'Master', user_id: 'master-user', is_active: false } });
            const isBusinessManager = jest.fn().mockResolvedValue(false);

            const result = await getMobileBookingDetails({ client, userId: 'master-user', bookingId: 'booking-1', isBusinessManager });

            expect(result).toMatchObject({ ok: false, error: 'not_found', status: 404 });
        });

        test('a manager of the business gets the staff view', async () => {
            const { client } = detailsClient(baseDetailsRow);
            const isBusinessManager = jest.fn().mockResolvedValue(true);

            const result = await getMobileBookingDetails({ client, userId: 'manager-user', bookingId: 'booking-1', isBusinessManager });

            expect(isBusinessManager).toHaveBeenCalledWith('biz-1');
            expect(result.ok && result.data.viewer_role).toBe('manager');
            expect(result.ok && result.data.client_name).toBe('Aida');
        });

        test('anyone else reads it as not found, even when a row comes back', async () => {
            const { client } = detailsClient(baseDetailsRow);

            const withoutManagerCheck = await getMobileBookingDetails({ client, userId: 'stranger', bookingId: 'booking-1' });
            const notManager = await getMobileBookingDetails({
                client,
                userId: 'stranger',
                bookingId: 'booking-1',
                isBusinessManager: jest.fn().mockResolvedValue(false),
            });

            expect(withoutManagerCheck).toMatchObject({ ok: false, error: 'not_found', status: 404 });
            expect(notManager).toMatchObject({ ok: false, error: 'not_found', status: 404 });
        });

        test('a failed role read is a 500, not a guess', async () => {
            const { client } = detailsClient(baseDetailsRow);

            const result = await getMobileBookingDetails({
                client,
                userId: 'stranger',
                bookingId: 'booking-1',
                isBusinessManager: jest.fn().mockRejectedValue(new Error('BUSINESS_ACCESS_READ_FAILED: user_roles')),
            });

            expect(result).toMatchObject({ ok: false, error: 'internal', status: 500 });
        });
    });

    test.each([
        ['Asia/Almaty', 'Asia/Almaty'],
        ['Europe/Moscow', 'Europe/Moscow'],
        [null, 'Asia/Bishkek'],
        ['', 'Asia/Bishkek'],
        ['Mars/Olympus', 'Asia/Bishkek'],
    ])('list returns the business time zone (ARCH-11): %p -> %p', async (tz, expected) => {
        const { client, select } = listClient([
            { id: 'b', start_at: 's', end_at: 'e', status: 'confirmed', service: null, staff: null, branch: null, business: [{ name: 'Biz', slug: 'biz', tz }] },
        ]);

        const result = await listMobileBookings({ client, userId: 'user-1' });

        expect(select.mock.calls[0][0]).toContain('business:businesses(name,slug,tz)');
        expect(result.ok && result.data[0].business).toEqual({ name: 'Biz', slug: 'biz', tz: expected });
    });

    test.each([
        ['Asia/Almaty', 'Asia/Almaty'],
        ['Europe/Moscow', 'Europe/Moscow'],
        [undefined, 'Asia/Bishkek'],
        ['not a zone', 'Asia/Bishkek'],
    ])('details return the business time zone (ARCH-11): %p -> %p', async (tz, expected) => {
        const { client, select } = detailsClient({
            id: 'b', start_at: 's', end_at: 'e', status: 'confirmed', client_id: 'user-1', service: null, staff: null, branch: null,
            business: { name: 'Biz', slug: 'biz', phones: null, tz },
        });

        const result = await getMobileBookingDetails({ client, userId: 'user-1', bookingId: 'b' });

        expect(select.mock.calls[0][0]).toContain('business:businesses(name, slug, phones, tz)');
        expect(result.ok && result.data.business?.tz).toBe(expected);
    });

    test('parses the page parameters with defaults and a cap', () => {
        expect(parseMobileBookingsPage(new URLSearchParams(''))).toEqual({ limit: 50, offset: 0 });
        expect(parseMobileBookingsPage(new URLSearchParams('limit=20&offset=40'))).toEqual({ limit: 20, offset: 40 });
        expect(parseMobileBookingsPage(new URLSearchParams('limit=1000&offset=-5'))).toEqual({ limit: 100, offset: 0 });
        expect(parseMobileBookingsPage(new URLSearchParams('limit=abc&offset=x'))).toEqual({ limit: 50, offset: 0 });
    });

    test('maps applied benefits defensively', () => {
        expect(mapAppliedPromotion(null)).toBeNull();
        expect(mapAppliedPromotion('x')).toBeNull();
        expect(mapAppliedPromotion({ promotion_type: 'birthday' })).toEqual({ title: 'birthday', discount_percent: null, final_amount: null });
        expect(mapAppliedPackage({ promotion_title: 'Pack', final_amount: '0' })).toEqual({ name: 'Pack', final_amount: 0 });
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
        // Cancelling stays the client's own action: a master who reads the booking cannot cancel it.
        expect(query.eq).toHaveBeenCalledWith('client_id', 'user-1');
        expect(from).toHaveBeenCalledTimes(1);
    });
});
