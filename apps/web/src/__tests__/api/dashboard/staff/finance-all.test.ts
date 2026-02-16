/**
 * Тесты для /api/dashboard/staff/finance/all
 * Финансовая статистика всех сотрудников бизнеса
 */

import { GET } from '@/app/api/dashboard/staff/finance/all/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/dashboard/staff/finance/all', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
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
            // Мокаем получение сотрудников
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [
                        {
                            id: 'staff-1',
                            full_name: 'Staff 1',
                            is_active: true,
                            branch_id: 'branch-1',
                        },
                        {
                            id: 'staff-2',
                            full_name: 'Staff 2',
                            is_active: true,
                            branch_id: 'branch-2',
                        },
                    ],
                    error: null,
                }),
            });

            // Мокаем получение смен для каждого сотрудника
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({
                    data: [
                        {
                            id: 'shift-1',
                            total_amount: 10000,
                            master_share: 6000,
                            salon_share: 4000,
                            consumables_amount: 1000,
                            late_minutes: 0,
                        },
                    ],
                    error: null,
                }),
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({
                    data: [
                        {
                            id: 'shift-2',
                            total_amount: 15000,
                            master_share: 9000,
                            salon_share: 6000,
                            consumables_amount: 1500,
                            late_minutes: 5,
                        },
                    ],
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/dashboard/staff/finance/all?period=day&date=2024-01-15', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('staff_stats');
            expect(data).toHaveProperty('total_stats');
        });

        test('должен успешно вернуть статистику за месяц', async () => {
            // Мокаем получение сотрудников
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/dashboard/staff/finance/all?period=month&date=2024-01', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('staff_stats');
            expect(data).toHaveProperty('total_stats');
        });
    });
});


