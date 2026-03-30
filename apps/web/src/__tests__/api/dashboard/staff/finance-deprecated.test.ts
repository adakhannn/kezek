import { GET } from '@/app/api/dashboard/staff/[id]/finance/route';
import {
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/withManagerAndStaffContext', () => ({
    withManagerAndStaffContext: jest.fn(),
}));

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

import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

describe('/api/dashboard/staff/[id]/finance (deprecated)', () => {
    const supabase = {
        from: jest.fn(),
    };

    const admin = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        (withManagerAndStaffContext as jest.Mock).mockImplementation(
            async (
                req: Request,
                context: unknown,
                options: unknown,
                callback: (args: {
                    supabase: typeof supabase;
                    admin: typeof admin;
                    bizId: string;
                    staffId: string;
                    staff: {
                        id: string;
                        biz_id: string;
                        percent_master: number;
                        percent_salon: number;
                        hourly_rate: number;
                    };
                }) => Promise<Response>,
            ) =>
                callback({
                    supabase,
                    admin,
                    bizId: 'biz-uuid',
                    staffId: '11111111-2222-3333-4444-555555555555',
                    staff: {
                        id: '11111111-2222-3333-4444-555555555555',
                        biz_id: 'biz-uuid',
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 500,
                    },
                }),
        );
    });

    test('returns 400 for invalid date format', async () => {
        const req = createMockRequest(
            'http://localhost/api/dashboard/staff/11111111-2222-3333-4444-555555555555/finance?date=invalid',
            { method: 'GET' },
        );

        const res = await GET(req, { params: { id: '11111111-2222-3333-4444-555555555555' } });
        await expectErrorResponse(res, 400);
    });

    test('returns 400 for out-of-range date', async () => {
        const req = createMockRequest(
            'http://localhost/api/dashboard/staff/11111111-2222-3333-4444-555555555555/finance?date=1800-01-01',
            { method: 'GET' },
        );

        const res = await GET(req, { params: { id: '11111111-2222-3333-4444-555555555555' } });
        await expectErrorResponse(res, 400);
    });

    test('returns finance payload successfully', async () => {
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

        supabase.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            })
            .mockReturnValueOnce(serviceStaffQuery);

        const req = createMockRequest(
            'http://localhost/api/dashboard/staff/11111111-2222-3333-4444-555555555555/finance?date=2024-01-14',
            { method: 'GET' },
        );

        const res = await GET(req, { params: { id: '11111111-2222-3333-4444-555555555555' } });
        const data = await expectSuccessResponse(res, 200);

        expect(data.data).toHaveProperty('today.exists', false);
        expect(data.data).toHaveProperty('services.0.name_ru', 'Service 1');
        expect(data.data).toHaveProperty('stats.shiftsCount', 1);
    });
});
