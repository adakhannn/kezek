/**
 * Интеграционные тесты для /api/branches/[id]/delete
 * Удаление филиала
 */

import { POST } from '@/app/api/branches/[id]/delete/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/branches/[id]/delete', () => {
    const mockSupabase = createMockSupabase();
    const mockServiceClient = createMockSupabase();
    const branchId = 'branch-id-123';

    function createTripleEqResultQuery<T>(result: T) {
        const query = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        query.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 3 ? Promise.resolve(result) : query;
        });

        return query;
    }

    function createBookingsQuery(result: { data: unknown[]; count: number; error?: unknown }) {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(result),
        };
    }

    function createOtherBranchQuery(result: { data: unknown; error: unknown }) {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue(result),
        };
    }

    function createDeleteQuery(result: { data: unknown; error: unknown }) {
        const query = {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        query.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 2 ? Promise.resolve(result) : query;
        });

        return query;
    }

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

            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Филиал не принадлежит этому бизнесу',
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 400, 'validation');
        });

        test('должен вернуть 400 если у филиала есть активные услуги', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: { id: branchId, biz_id: 'biz-id' },
                error: null,
            });

            mockServiceClient.from.mockImplementation((table: string) => {
                if (table === 'services') {
                    return createTripleEqResultQuery({ count: 5, error: null });
                }
                throw new Error(`Unexpected table: ${table}`);
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 400, 'conflict');
        });
    });

    describe('Успешное удаление', () => {
        test('должен успешно удалить филиал без активных услуг', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: true,
                error: null,
            });

            // Проверка принадлежности филиала
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: { id: branchId, biz_id: 'biz-id' },
                error: null,
            });

            mockServiceClient.from.mockImplementation((table: string) => {
                if (table === 'services') {
                    if (mockServiceClient.from.mock.calls.filter(([name]) => name === 'services').length === 1) {
                        return createTripleEqResultQuery({ count: 0, error: null });
                    }
                    return createTripleEqResultQuery({ data: [], error: null });
                }

                if (table === 'staff') {
                    return createTripleEqResultQuery({ count: 0, error: null });
                }

                if (table === 'bookings') {
                    return createBookingsQuery({
                        data: [],
                        count: 0,
                        error: null,
                    });
                }

                if (table === 'branches') {
                    return createOtherBranchQuery({
                        data: null,
                        error: null,
                    });
                }

                throw new Error(`Unexpected table: ${table}`);
            });

            mockServiceClient.from
                .mockImplementationOnce(() => createTripleEqResultQuery({ count: 0, error: null }))
                .mockImplementationOnce(() => createTripleEqResultQuery({ count: 0, error: null }))
                .mockImplementationOnce(() => createBookingsQuery({ data: [], count: 0, error: null }))
                .mockImplementationOnce(() => createOtherBranchQuery({ data: null, error: null }))
                .mockImplementationOnce(() => createTripleEqResultQuery({ data: [], error: null }))
                .mockImplementationOnce(() => createDeleteQuery({ data: null, error: null }));

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

