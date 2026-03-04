/**
 * Тесты для /api/dashboard/staff/finance/all
 * Финансовая статистика всех сотрудников бизнеса
 */

import { GET } from '@/app/api/dashboard/staff/finance/all/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

describe('/api/dashboard/staff/finance/all', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            userId: 'user-uuid',
            bizId,
        });

        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при невалидном формате даты для day периода', async () => {
            const req = createMockRequest('http://localhost/api/dashboard/staff/finance/all?period=day&date=invalid', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешное получение статистики', () => {
        test('должен успешно вернуть статистику всех сотрудников за день', async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [
                        { id: 'staff-1', full_name: 'Staff 1', is_active: true, branch_id: 'branch-1', hourly_rate: null, percent_master: 60, percent_salon: 40 },
                        { id: 'staff-2', full_name: 'Staff 2', is_active: true, branch_id: 'branch-2', hourly_rate: null, percent_master: 60, percent_salon: 40 },
                    ],
                    error: null,
                }),
            });
            (mockAdmin.rpc as jest.Mock).mockResolvedValue({
                data: {
                    staff_stats: [
                        { staff_id: 'staff-1', staff_name: 'Staff 1', is_active: true, branch_id: 'branch-1', shifts: { total: 1, closed: 1, open: 0 }, stats: { total_amount: 10000, total_master: 6000, total_salon: 4000, total_consumables: 1000, total_late_minutes: 0 } },
                        { staff_id: 'staff-2', staff_name: 'Staff 2', is_active: true, branch_id: 'branch-2', shifts: { total: 1, closed: 1, open: 0 }, stats: { total_amount: 15000, total_master: 9000, total_salon: 6000, total_consumables: 1500, total_late_minutes: 5 } },
                    ],
                    total_stats: { total_shifts: 2, closed_shifts: 2, open_shifts: 0, total_amount: 25000, total_master: 15000, total_salon: 10000, total_consumables: 2500, total_late_minutes: 5 },
                },
                error: null,
            });
            mockAdmin.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({ data: [], error: null }),
            });

            const req = createMockRequest('http://localhost/api/dashboard/staff/finance/all?period=day&date=2024-01-15', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data.data).toHaveProperty('staffStats');
            expect(data.data).toHaveProperty('totalStats');
        });

        test('должен успешно вернуть статистику за месяц', async () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
            });
            (mockAdmin.rpc as jest.Mock).mockResolvedValue({
                data: { staff_stats: [], total_stats: null },
                error: null,
            });
            mockAdmin.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({ data: [], error: null }),
            });

            const req = createMockRequest('http://localhost/api/dashboard/staff/finance/all?period=month&date=2024-01', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data.data).toHaveProperty('staffStats');
            expect(data.data).toHaveProperty('totalStats');
        });
    });
});


