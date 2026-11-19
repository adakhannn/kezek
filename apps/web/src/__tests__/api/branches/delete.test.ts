/**
 * Интеграционные тесты для /api/branches/[id]/delete
 * Удаление филиала
 */

import { POST } from '@/app/api/branches/[id]/delete/route';
import { createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

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

    // DB-14, ARCH-08: the route asks one database command to check and delete in one transaction.
    function deleteCommandAnswers(error: { message: string; code?: string } | null) {
        mockServiceClient.rpc.mockResolvedValueOnce({ data: null, error });
    }

    async function deleteBranch() {
        const req = createMockRequest(`http://localhost/api/branches/${branchId}/delete`, {
            method: 'POST',
        });
        return POST(req, { params: { id: branchId } });
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

            await expectErrorResponse(await deleteBranch(), 403, 'FORBIDDEN');
            expect(mockServiceClient.rpc).not.toHaveBeenCalled();
        });
    });

    describe('Отказы', () => {
        beforeEach(() => {
            mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });
        });

        test('должен вернуть 400 если филиал не принадлежит бизнесу', async () => {
            deleteCommandAnswers({ message: 'BRANCH_NOT_FOUND', code: 'P0002' });
            await expectErrorResponse(await deleteBranch(), 400, 'validation');
        });

        test('должен вернуть 409 BRANCH_IN_USE если у филиала есть активные сотрудники или услуги', async () => {
            deleteCommandAnswers({ message: 'BRANCH_IN_USE', code: 'P0001' });
            const data = await expectErrorResponse(await deleteBranch(), 409, 'conflict');
            expect(data.details).toEqual({ code: 'BRANCH_IN_USE' });
        });

        test('должен вернуть 409 BRANCH_HAS_HISTORY и ничего не удалять, если у филиала есть история', async () => {
            deleteCommandAnswers({ message: 'BRANCH_HAS_HISTORY', code: 'P0001' });
            const data = await expectErrorResponse(await deleteBranch(), 409, 'conflict');
            expect(data.details).toEqual({ code: 'BRANCH_HAS_HISTORY' });
            expect(mockServiceClient.from).not.toHaveBeenCalled();
        });

        test('неожиданная ошибка БД — 500 без текста БД', async () => {
            deleteCommandAnswers({ message: 'deadlock detected', code: '40P01' });
            const data = await expectErrorResponse(await deleteBranch(), 500, 'internal');
            expect(JSON.stringify(data)).not.toContain('deadlock');
        });
    });

    describe('Успешное удаление', () => {
        test('должен удалить филиал без истории одной командой БД', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });
            deleteCommandAnswers(null);

            const data = await expectSuccessResponse(await deleteBranch());

            expect(data.ok).toBe(true);
            expect(mockServiceClient.rpc).toHaveBeenCalledWith('delete_branch_without_history', {
                p_biz_id: 'biz-id',
                p_branch_id: branchId,
            });
            expect(mockServiceClient.from).not.toHaveBeenCalled();
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

