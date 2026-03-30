import { GET } from '@/app/api/staff/shift/today/route';

jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/time', () => ({
    TZ: 'Asia/Bishkek',
    formatDateInTz: jest.fn(() => '2024-01-15'),
}));

import { getStaffContext } from '@/lib/authBiz';

type QueryResult = { data: unknown; error: unknown };

function createAwaitableBuilder(
    result: QueryResult,
    finalMethod: 'eq' | 'gte' | 'order' | 'maybeSingle',
    finalCallIndex = 1,
) {
    const counters = { eq: 0, gte: 0, order: 0, maybeSingle: 0 };
    const query: Record<string, jest.Mock> = {};
    query.select = jest.fn(() => query);
    query.eq = jest.fn(() => {
        counters.eq += 1;
        return finalMethod === 'eq' && counters.eq === finalCallIndex
            ? Promise.resolve(result)
            : query;
    });
    query.lte = jest.fn(() => query);
    query.gte = jest.fn(() => {
        counters.gte += 1;
        return finalMethod === 'gte' && counters.gte === finalCallIndex
            ? Promise.resolve(result)
            : query;
    });
    query.neq = jest.fn(() => query);
    query.order = jest.fn(() => {
        counters.order += 1;
        return finalMethod === 'order' && counters.order === finalCallIndex
            ? Promise.resolve(result)
            : query;
    });
    query.maybeSingle = jest.fn(() => {
        counters.maybeSingle += 1;
        return finalMethod === 'maybeSingle' && counters.maybeSingle === finalCallIndex
            ? Promise.resolve(result)
            : Promise.resolve(result);
    });
    return query;
}

describe('/api/staff/shift/today', () => {
    const mockSupabase = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));

        (getStaffContext as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            staffId: 'staff-1',
            bizId: 'biz-1',
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('returns today shift data when an open shift exists', async () => {
        mockSupabase.from
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: { percent_master: 60, percent_salon: 40, hourly_rate: 100 },
                        error: null,
                    },
                    'maybeSingle',
                ),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder({ data: [], error: null }, 'gte'),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder({ data: null, error: null }, 'maybeSingle'),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: {
                            intervals: [{ start: '09:00', end: '18:00' }],
                        },
                        error: null,
                    },
                    'maybeSingle',
                ),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: {
                            id: 'shift-1',
                            shift_date: '2024-01-15',
                            status: 'open',
                            opened_at: '2024-01-15T09:00:00.000Z',
                            total_amount: 0,
                            master_share: 0,
                            salon_share: 0,
                        },
                        error: null,
                    },
                    'maybeSingle',
                ),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: [
                            {
                                id: 'item-1',
                                client_name: 'Client 1',
                                service_name: 'Haircut',
                                service_amount: 1000,
                                consumables_amount: 100,
                                note: null,
                                booking_id: null,
                                created_at: '2024-01-15T10:00:00.000Z',
                            },
                        ],
                        error: null,
                    },
                    'order',
                    2,
                ),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder({ data: [], error: null }, 'order'),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: [
                            {
                                services: {
                                    name_ru: 'Service 1',
                                    name_ky: null,
                                    name_en: null,
                                },
                            },
                        ],
                        error: null,
                    },
                    'eq',
                    3,
                ),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: [
                            {
                                id: 'closed-shift',
                                shift_date: '2024-01-14',
                                status: 'closed',
                                total_amount: 5000,
                                master_share: 3000,
                                salon_share: 2000,
                                late_minutes: 10,
                                guaranteed_amount: 0,
                                topup_amount: 0,
                            },
                        ],
                        error: null,
                    },
                    'order',
                ),
            );

        const response = await GET();
        const data = await response.json();
        const payload = data.data;

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(payload.today.exists).toBe(true);
        expect(payload.today.status).toBe('open');
        expect(payload.today.items).toHaveLength(1);
        expect(payload.hourlyRate).toBe(100);
        expect(payload.currentHoursWorked).toBe(3);
        expect(payload.currentGuaranteedAmount).toBe(300);
        expect(payload.stats.totalAmount).toBe(5000);
    });

    test('returns no-shift payload when there is no open shift', async () => {
        mockSupabase.from
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: { percent_master: 60, percent_salon: 40, hourly_rate: null },
                        error: null,
                    },
                    'maybeSingle',
                ),
            )
            .mockReturnValueOnce(createAwaitableBuilder({ data: [], error: null }, 'gte'))
            .mockReturnValueOnce(createAwaitableBuilder({ data: null, error: null }, 'maybeSingle'))
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: {
                            intervals: [{ start: '09:00', end: '18:00' }],
                        },
                        error: null,
                    },
                    'maybeSingle',
                ),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder({ data: null, error: null }, 'maybeSingle'),
            )
            .mockReturnValueOnce(createAwaitableBuilder({ data: [], error: null }, 'order'))
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: [
                            {
                                services: {
                                    name_ru: 'Service 1',
                                    name_ky: null,
                                    name_en: null,
                                },
                            },
                        ],
                        error: null,
                    },
                    'eq',
                    3,
                ),
            )
            .mockReturnValueOnce(createAwaitableBuilder({ data: [], error: null }, 'order'));

        const response = await GET();
        const data = await response.json();
        const payload = data.data;

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(payload.today.exists).toBe(false);
        expect(payload.today.status).toBe('none');
        expect(payload.hourlyRate).toBeNull();
    });

    test('marks the day as off when time off exists', async () => {
        mockSupabase.from
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: { percent_master: 60, percent_salon: 40, hourly_rate: null },
                        error: null,
                    },
                    'maybeSingle',
                ),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder({ data: [{ id: 'time-off-1' }], error: null }, 'gte'),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder({ data: null, error: null }, 'maybeSingle'),
            )
            .mockReturnValueOnce(createAwaitableBuilder({ data: [], error: null }, 'order'))
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: [
                            {
                                services: {
                                    name_ru: 'Service 1',
                                    name_ky: null,
                                    name_en: null,
                                },
                            },
                        ],
                        error: null,
                    },
                    'eq',
                    3,
                ),
            )
            .mockReturnValueOnce(createAwaitableBuilder({ data: [], error: null }, 'order'));

        const response = await GET();
        const data = await response.json();
        const payload = data.data;

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(payload.isDayOff).toBe(true);
    });

    test('returns 500 when loading today shift fails', async () => {
        mockSupabase.from
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: { percent_master: 60, percent_salon: 40, hourly_rate: null },
                        error: null,
                    },
                    'maybeSingle',
                ),
            )
            .mockReturnValueOnce(createAwaitableBuilder({ data: [], error: null }, 'gte'))
            .mockReturnValueOnce(createAwaitableBuilder({ data: null, error: null }, 'maybeSingle'))
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: null,
                        error: { message: 'shift load failed' },
                    },
                    'maybeSingle',
                ),
            );

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('internal');
    });

    test('returns 500 when loading aggregated stats fails', async () => {
        mockSupabase.from
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: { percent_master: 60, percent_salon: 40, hourly_rate: null },
                        error: null,
                    },
                    'maybeSingle',
                ),
            )
            .mockReturnValueOnce(createAwaitableBuilder({ data: [], error: null }, 'gte'))
            .mockReturnValueOnce(createAwaitableBuilder({ data: null, error: null }, 'maybeSingle'))
            .mockReturnValueOnce(createAwaitableBuilder({ data: null, error: null }, 'maybeSingle'))
            .mockReturnValueOnce(createAwaitableBuilder({ data: [], error: null }, 'order'))
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: [
                            {
                                services: {
                                    name_ru: 'Service 1',
                                    name_ky: null,
                                    name_en: null,
                                },
                            },
                        ],
                        error: null,
                    },
                    'eq',
                    3,
                ),
            )
            .mockReturnValueOnce(
                createAwaitableBuilder(
                    {
                        data: null,
                        error: { message: 'stats failed' },
                    },
                    'order',
                ),
            );

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('internal');
    });

    test('returns 401 for unauthorized staff context failures', async () => {
        (getStaffContext as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('auth');
    });
});
