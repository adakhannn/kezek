/**
 * Интеграционные тесты для /api/branches/[id]/delete
 * Удаление филиала
 */

import { POST } from '@/app/api/branches/[id]/delete/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/branches/[id]/delete', () => {
    const mockSupabase = createMockSupabase();
    const mockServiceClient = createMockSupabase();
    const branchId = 'branch-id-123';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            bizId: 'biz-id',
        });

        (getRouteParamUuid as jest.Mock).mockResolvedValue(branchId);
        (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
    });

    describe('Авторизация', () => {
        test('должен вернуть 403 если пользователь не суперадмин', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: false,
                error: null,
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 если филиал не принадлежит бизнесу', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            mockServiceClient.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: branchId, biz_id: 'other-biz-id' },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 400, 'BRANCH_NOT_IN_THIS_BUSINESS');
        });

        test('должен вернуть 400 если у филиала есть активные услуги', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            mockServiceClient.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: branchId, biz_id: 'biz-id' },
                    error: null,
                }),
            });

            // Проверка активных услуг
            mockServiceClient.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                count: 5, // Есть активные услуги
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 400, 'HAS_SERVICES');
        });
    });

    describe('Успешное удаление', () => {
        test('должен успешно удалить филиал без активных услуг', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            // Проверка принадлежности филиала
            mockServiceClient.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: branchId, biz_id: 'biz-id' },
                    error: null,
                }),
            });

            // Проверка активных услуг (нет активных)
            mockServiceClient.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                count: 0,
            });

            // Удаление филиала
            mockServiceClient.from.mockReturnValueOnce({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: branchId } });
            const data = await expectSuccessResponse(res);

            expect(data.ok).toBe(true);
        });
    });

    describe('Валидация UUID', () => {
        test('должен вернуть 400 если UUID некорректный', async () => {
            (getRouteParamUuid as jest.Mock).mockRejectedValueOnce(new Error('Invalid UUID'));

            const req = createMockRequest(`http://localhost/api/branches/invalid-id/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: 'invalid-id' } });
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });
});

