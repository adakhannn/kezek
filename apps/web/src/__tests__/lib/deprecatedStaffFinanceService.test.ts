jest.mock('@/lib/time', () => ({
    TZ: 'Asia/Bishkek',
    todayStringInTz: jest.fn(() => '2024-01-15'),
    formatDateInTz: jest.fn((value: Date | string) => {
        if (typeof value === 'string') {
            return value.slice(0, 10);
        }
        return value.toISOString().slice(0, 10);
    }),
}));

import { runDeprecatedStaffFinance } from '@/lib/deprecatedStaffFinanceService';

describe('deprecatedStaffFinanceService', () => {
    const supabase = {
        from: jest.fn(),
    };

    const admin = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns validation failure for invalid date', async () => {
        const result = await runDeprecatedStaffFinance({
            req: new Request('http://localhost/api/dashboard/staff/staff-id/finance?date=bad-date'),
            supabase,
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
            staff: {
                percent_master: 60,
                percent_salon: 40,
                hourly_rate: 500,
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Invalid query parameters',
        });
    });

    test('returns expected finance payload for legacy route flow', async () => {
        admin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce((() => {
                const query = {
                    select: jest.fn(),
                    eq: jest.fn(),
                    gte: jest.fn(),
                    order: jest.fn(),
                };
                query.select.mockReturnValue(query);
                query.eq.mockReturnValue(query);
                query.gte.mockReturnValue(query);
                query.order.mockResolvedValue({
                    data: [
                        {
                            total_amount: 8000,
                            master_share: 4800,
                            salon_share: 3200,
                            late_minutes: 0,
                        },
                    ],
                    error: null,
                });
                return query;
            })())
            .mockReturnValueOnce((() => {
                const query = {
                    select: jest.fn(),
                    eq: jest.fn(),
                    order: jest.fn(),
                };
                query.select.mockReturnValue(query);
                query.eq.mockReturnValue(query);
                query.order.mockResolvedValue({
                    data: [
                        {
                            shift_date: '2024-01-10',
                            status: 'closed',
                            total_amount: 8000,
                            master_share: 4800,
                            salon_share: 3200,
                            late_minutes: 0,
                        },
                    ],
                    error: null,
                });
                return query;
            })());

        const bookingsQuery = {
            select: jest.fn(),
            eq: jest.fn(),
            gte: jest.fn(),
            lte: jest.fn(),
            neq: jest.fn(),
            order: jest.fn(),
        };
        bookingsQuery.select.mockReturnValue(bookingsQuery);
        bookingsQuery.eq.mockReturnValue(bookingsQuery);
        bookingsQuery.gte.mockReturnValue(bookingsQuery);
        bookingsQuery.lte.mockReturnValue(bookingsQuery);
        bookingsQuery.neq.mockReturnValue(bookingsQuery);
        bookingsQuery.order.mockResolvedValue({
            data: [],
            error: null,
        });

        const serviceStaffQuery = {
            select: jest.fn(),
            eq: jest.fn(),
        };
        serviceStaffQuery.select.mockReturnValue(serviceStaffQuery);
        let eqCalls = 0;
        serviceStaffQuery.eq.mockImplementation(() => {
            eqCalls += 1;
            if (eqCalls >= 3) {
                return Promise.resolve({
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
                });
            }

            return serviceStaffQuery;
        });

        supabase.from.mockReturnValueOnce(bookingsQuery).mockReturnValueOnce(serviceStaffQuery);

        const result = await runDeprecatedStaffFinance({
            req: new Request('http://localhost/api/dashboard/staff/staff-id/finance?date=2024-01-14'),
            supabase,
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
            staff: {
                percent_master: 60,
                percent_salon: 40,
                hourly_rate: 500,
            },
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data).toMatchObject({
                today: {
                    exists: false,
                },
                services: [
                    {
                        name_ru: 'Service 1',
                    },
                ],
                stats: {
                    shiftsCount: 1,
                },
            });
        }
    });
});
