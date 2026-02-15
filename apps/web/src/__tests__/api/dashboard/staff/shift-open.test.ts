/**
 * Тесты для /api/dashboard/staff/[id]/shift/open
 * Открытие смены для сотрудника (для владельца/менеджера)
 */

import { POST } from '@/app/api/dashboard/staff/[id]/shift/open/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {
        critical: {},
    },
}));

describe('/api/dashboard/staff/[id]/shift/open', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamUuid as jest.Mock).mockResolvedValue(staffId);
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 404 если сотрудник не найден', async () => {
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/open`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 404);
        });

        test('должен вернуть 403 если сотрудник не принадлежит бизнесу', async () => {
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: staffId,
                        biz_id: 'other-biz-id', // Другой бизнес
                        branch_id: 'branch-id',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/open`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            await expectErrorResponse(res, 403);
        });
    });

    describe('Успешное открытие смены', () => {
        test('должен успешно открыть смену для сотрудника', async () => {
            // Мокаем проверку сотрудника
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: 'branch-id',
                    },
                    error: null,
                }),
            });

            // Мокаем проверку существующей смены
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null, // Смена не существует
                    error: null,
                }),
            });

            // Мокаем создание смены
            mockAdmin.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        id: 'shift-id',
                        staff_id: staffId,
                        shift_date: '2024-01-15',
                        status: 'open',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/open?date=2024-01-15`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('shift');
        });

        test('должен вернуть существующую смену если она уже открыта', async () => {
            // Мокаем проверку сотрудника
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: 'branch-id',
                    },
                    error: null,
                }),
            });

            // Мокаем проверку существующей смены (найдена)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'existing-shift-id',
                        staff_id: staffId,
                        shift_date: '2024-01-15',
                        status: 'open',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/open?date=2024-01-15`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: staffId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('shift');
        });
    });
});

