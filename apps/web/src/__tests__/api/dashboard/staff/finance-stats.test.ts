import { GET } from '@/app/api/dashboard/staff/[id]/finance/stats/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../../testHelpers';

setupApiTestMocks();

import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

jest.mock('@/lib/withManagerAndStaffContext', () => ({
    withManagerAndStaffContext: jest.fn(),
}));

describe('/api/dashboard/staff/[id]/finance/stats', () => {
    const staffId = '123e4567-e89b-42d3-a456-426614174000';
    const bizId = '123e4567-e89b-42d3-a456-426614174001';
    const mockAdmin = createMockSupabase();
    const fixedNow = new Date('2024-01-15T10:00:00.000Z');

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(fixedNow);

        (withManagerAndStaffContext as jest.Mock).mockImplementation(
            async (_req, _context, _options, handler) =>
                handler({
                    supabase: mockAdmin,
                    admin: mockAdmin,
                    bizId,
                    userId: 'manager-user-id',
                    staffId,
                    staff: {
                        id: staffId,
                        biz_id: bizId,
                        full_name: 'Test Staff',
                    },
                }),
        );
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('validation', () => {
        test('returns 400 for invalid day date format', async () => {
            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/finance/stats?period=day&date=invalid`,
                { method: 'GET' },
            );

            const res = await GET(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400, 'validation');
        });

        test('returns 400 for date outside supported range', async () => {
            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/finance/stats?period=day&date=1800-01-01`,
                { method: 'GET' },
            );

            const res = await GET(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400, 'validation');
        });

        test('returns 400 for impossible date', async () => {
            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/finance/stats?period=day&date=2024-02-30`,
                { method: 'GET' },
            );

            const res = await GET(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400, 'validation');
        });
    });

    describe('success', () => {
        test('returns day stats with closed shift and grouped items', async () => {
            mockAdmin.from
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    lte: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'shift-1',
                                shift_date: '2024-01-15',
                                total_amount: 10000,
                                master_share: 6000,
                                salon_share: 4000,
                                status: 'closed',
                                consumables_amount: 500,
                                late_minutes: 10,
                                percent_master: 60,
                                percent_salon: 40,
                                hourly_rate: null,
                                guaranteed_amount: 0,
                                hours_worked: 8,
                                opened_at: '2024-01-15T09:00:00.000Z',
                                closed_at: '2024-01-15T17:00:00.000Z',
                                staff: null,
                            },
                        ],
                        error: null,
                    }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'item-1',
                                shift_id: 'shift-1',
                                client_name: 'Client 1',
                                service_name: 'Service 1',
                                service_amount: 7000,
                                consumables_amount: 300,
                                note: null,
                                booking_id: null,
                                created_at: '2024-01-15T11:00:00.000Z',
                            },
                            {
                                id: 'item-2',
                                shift_id: 'shift-1',
                                client_name: 'Client 2',
                                service_name: 'Service 2',
                                service_amount: 3000,
                                consumables_amount: 200,
                                note: null,
                                booking_id: null,
                                created_at: '2024-01-15T12:00:00.000Z',
                            },
                        ],
                        error: null,
                    }),
                });

            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/finance/stats?period=day&date=2024-01-15`,
                { method: 'GET' },
            );

            const res = await GET(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data.data.stats.staffName).toBe('Test Staff');
            expect(data.data.stats.period).toBe('day');
            expect(data.data.stats.totalAmount).toBe(10000);
            expect(data.data.stats.totalConsumables).toBe(500);
            expect(data.data.stats.totalClients).toBe(2);
            expect(data.data.stats.shifts).toHaveLength(1);
            expect(data.data.stats.shifts[0].items).toHaveLength(2);
        });

        test('returns month stats and includes current open shift for today', async () => {
            mockAdmin.from
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            id: 'open-shift',
                            shift_date: '2024-01-15',
                            status: 'open',
                            total_amount: 0,
                            master_share: 0,
                            salon_share: 0,
                            consumables_amount: 0,
                            late_minutes: 0,
                            percent_master: 60,
                            percent_salon: 40,
                            hourly_rate: 500,
                            guaranteed_amount: 0,
                            hours_worked: null,
                            opened_at: '2024-01-15T09:00:00.000Z',
                            closed_at: null,
                            staff: {
                                hourly_rate: 500,
                                percent_master: 60,
                                percent_salon: 40,
                            },
                        },
                        error: null,
                    }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    lte: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({
                        data: [],
                        error: null,
                    }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({
                        data: [],
                        error: null,
                    }),
                });

            const req = createMockRequest(
                `http://localhost/api/dashboard/staff/${staffId}/finance/stats?period=month&date=2024-01`,
                { method: 'GET' },
            );

            const res = await GET(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data.data.stats.period).toBe('month');
            expect(data.data.stats.openShiftsCount).toBe(1);
            expect(data.data.stats.shifts[0].status).toBe('open');
        });
    });
});
