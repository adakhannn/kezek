/**
 * Тесты для /api/dashboard/staff/[id]/finance (deprecated)
 * Финансовая информация сотрудника (deprecated endpoint)
 */

import { GET } from '@/app/api/dashboard/staff/[id]/finance/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

describe('/api/dashboard/staff/[id]/finance (deprecated)', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            userId: 'user-uuid',
            bizId,
        });

        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamUuid as jest.Mock).mockResolvedValue(staffId);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при невалидном формате даты', async () => {
            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/finance?date=invalid`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при дате вне допустимого диапазона', async () => {
            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/finance?date=1800-01-01`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { id: staffId } });
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешное получение данных', () => {
        test('должен успешно вернуть финансовую информацию сотрудника', async () => {
            // Мокаем проверку сотрудника
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: 'branch-id',
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 500,
                    },
                    error: null,
                }),
            });

            // Мокаем получение смены
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'shift-id',
                        shift_date: '2024-01-15',
                        status: 'open',
                        total_amount: 10000,
                    },
                    error: null,
                }),
            });

            // Мокаем получение элементов смены
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });

            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
            });
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
            });
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/finance?date=2024-01-15`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('shift');
        });
    });
});


