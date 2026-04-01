jest.mock('@/lib/log', () => ({
    logDebug: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

import { getServiceClient } from '@/lib/supabaseService';
import { resolveWhatsAppMessageContext } from '@/lib/whatsAppMessageContext';

function createQueryBuilder() {
    const query = {
        select: jest.fn(),
        eq: jest.fn(),
        in: jest.fn(),
        gte: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        maybeSingle: jest.fn(),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);

    return query;
}

describe('whatsAppMessageContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('resolves active bookings for an existing profile', async () => {
        const profileQuery = createQueryBuilder();
        profileQuery.maybeSingle.mockResolvedValue({
            data: { id: 'client-1', phone: '+7700' },
            error: null,
        });

        const bookingsQuery = createQueryBuilder();
        bookingsQuery.limit.mockResolvedValue({
            data: [
                {
                    id: 'booking-1',
                    biz_id: 'biz-1',
                    start_at: '2026-03-31T10:00:00.000Z',
                    services: { name_ru: 'Стрижка' },
                    staff: { full_name: 'Алия' },
                },
            ],
            error: null,
        });

        (getServiceClient as jest.Mock).mockReturnValue({
            from: jest
                .fn()
                .mockReturnValueOnce(profileQuery)
                .mockReturnValueOnce(bookingsQuery),
        });

        await expect(resolveWhatsAppMessageContext('+7700')).resolves.toEqual({
            clientId: 'client-1',
            activeBookings: [
                {
                    id: 'booking-1',
                    biz_id: 'biz-1',
                    start_at: '2026-03-31T10:00:00.000Z',
                    services: { name_ru: 'Стрижка' },
                    staff: { full_name: 'Алия' },
                },
            ],
            bizId: 'biz-1',
        });
    });

    test('falls back to last booking business when profile has no active bookings', async () => {
        const profileQuery = createQueryBuilder();
        profileQuery.maybeSingle.mockResolvedValue({
            data: { id: 'client-1', phone: '+7700' },
            error: null,
        });

        const activeBookingsQuery = createQueryBuilder();
        activeBookingsQuery.limit.mockResolvedValue({ data: [], error: null });

        const lastBookingQuery = createQueryBuilder();
        lastBookingQuery.maybeSingle.mockResolvedValue({
            data: { biz_id: 'biz-9' },
            error: null,
        });

        (getServiceClient as jest.Mock).mockReturnValue({
            from: jest
                .fn()
                .mockReturnValueOnce(profileQuery)
                .mockReturnValueOnce(activeBookingsQuery)
                .mockReturnValueOnce(lastBookingQuery),
        });

        await expect(resolveWhatsAppMessageContext('+7700')).resolves.toEqual({
            clientId: 'client-1',
            activeBookings: [],
            bizId: 'biz-9',
        });
    });

    test('uses guest bookings when no profile exists', async () => {
        const profileQuery = createQueryBuilder();
        profileQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

        const guestBookingsQuery = createQueryBuilder();
        guestBookingsQuery.limit.mockResolvedValue({
            data: [
                {
                    id: 'booking-2',
                    biz_id: 'biz-2',
                    start_at: '2026-03-31T12:00:00.000Z',
                    services: { name_ru: 'Маникюр' },
                    staff: { full_name: 'Мира' },
                },
            ],
            error: null,
        });

        (getServiceClient as jest.Mock).mockReturnValue({
            from: jest
                .fn()
                .mockReturnValueOnce(profileQuery)
                .mockReturnValueOnce(guestBookingsQuery),
        });

        await expect(resolveWhatsAppMessageContext('+7700')).resolves.toEqual({
            clientId: null,
            activeBookings: [
                {
                    id: 'booking-2',
                    biz_id: 'biz-2',
                    start_at: '2026-03-31T12:00:00.000Z',
                    services: { name_ru: 'Маникюр' },
                    staff: { full_name: 'Мира' },
                },
            ],
            bizId: 'biz-2',
        });
    });
});
