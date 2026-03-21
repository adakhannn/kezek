/**
 * Тесты для /api/dashboard/staff/[id]/finance/stats
 * Статистика финансов сотрудника
 */

import { GET } from '@/app/api/dashboard/staff/[id]/finance/stats/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

describe('/api/dashboard/staff/[id]/finance/stats', () => {
    const mockSupabase = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            userId: 'user-uuid',
            bizId,
        });

        (getRouteParamUuid as jest.Mock).mockResolvedValue(staffId);
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при невалидном формате даты для day периода', async () => {
            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/finance/stats?period=day&date=invalid`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при дате вне допустимого диапазона', async () => {
            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/finance/stats?period=day&date=1800-01-01`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при невалидной дате (например, 30 февраля)', async () => {
            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/finance/stats?period=day&date=2024-02-30`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешное получение статистики', () => {
        test('должен успешно получить статистику за день', async () => {
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: staffId, biz_id: bizId, full_name: 'Test Staff' },
                    error: null,
                }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });
            mockSupabase.from.mockReturnValueOnce({
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
                            consumables_amount: 0,
                            late_minutes: 0,
                            percent_master: 60,
                            percent_salon: 40,
                            hourly_rate: null,
                            guaranteed_amount: 0,
                            hours_worked: null,
                            opened_at: null,
                            closed_at: null,
                            staff: null,
                        },
                    ],
                    error: null,
                }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [
                        {
                            id: 'item-1',
                            shift_id: 'shift-1',
                            client_name: 'Client 1',
                            service_name: 'Service 1',
                            service_amount: 5000,
                            consumables_amount: 500,
                        },
                    ],
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/finance/stats?period=day&date=2024-01-15`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data.data).toHaveProperty('stats');
        });

        test('должен успешно получить статистику за месяц', async () => {
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: staffId, biz_id: bizId, full_name: 'Test Staff' },
                    error: null,
                }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/finance/stats?period=month&date=2024-01`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data.data).toHaveProperty('stats');
        });
    });
});


