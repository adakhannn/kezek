/**
 * Тесты для /api/dashboard/branches/[branchId]/promotions/[promotionId]
 * Обновление и удаление акции
 */

import { PATCH, DELETE } from '@/app/api/dashboard/branches/[branchId]/promotions/[promotionId]/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

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

describe('/api/dashboard/branches/[branchId]/promotions/[promotionId]', () => {
    const mockAdmin = createMockSupabase();
    const branchId = 'branch-uuid';
    const promotionId = 'promotion-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        // Мокаем getRouteParamUuid для обоих параметров
        (getRouteParamUuid as jest.Mock).mockImplementation(async (context: unknown, param: string) => {
            if (param === 'branchId') return branchId;
            if (param === 'promotionId') return promotionId;
            throw new Error(`Unknown param: ${param}`);
        });
    });

    describe('PATCH /api/dashboard/branches/[branchId]/promotions/[promotionId]', () => {
        test('должен успешно обновить акцию', async () => {
            // Мокаем проверку акции
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: promotionId,
                        branch_id: branchId,
                        biz_id: bizId,
                        promotion_type: 'free_after_n_visits',
                    },
                    error: null,
                }),
            });

            // Мокаем обновление акции
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        id: promotionId,
                        title_ru: 'Updated Promotion',
                        is_active: true,
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions/${promotionId}`, {
                method: 'PATCH',
                body: {
                    title_ru: 'Updated Promotion',
                    is_active: false,
                },
            });

            const res = await PATCH(req, { params: { branchId, promotionId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('promotion');
        });

        test('должен вернуть 404 если акция не найдена', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions/${promotionId}`, {
                method: 'PATCH',
                body: {
                    title_ru: 'Updated Promotion',
                },
            });

            const res = await PATCH(req, { params: { branchId, promotionId } });
            await expectErrorResponse(res, 404, 'PROMOTION_NOT_FOUND_OR_ACCESS_DENIED');
        });

        test('должен вернуть 400 при невалидном visit_count', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: promotionId,
                        branch_id: branchId,
                        biz_id: bizId,
                        promotion_type: 'free_after_n_visits',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions/${promotionId}`, {
                method: 'PATCH',
                body: {
                    params: { visit_count: 0 }, // Невалидное значение
                },
            });

            const res = await PATCH(req, { params: { branchId, promotionId } });
            await expectErrorResponse(res, 400, 'INVALID_VISIT_COUNT');
        });

        test('должен вернуть 400 при невалидном discount_percent', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: promotionId,
                        branch_id: branchId,
                        biz_id: bizId,
                        promotion_type: 'birthday_discount',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions/${promotionId}`, {
                method: 'PATCH',
                body: {
                    params: { discount_percent: 150 }, // Невалидное значение (>100)
                },
            });

            const res = await PATCH(req, { params: { branchId, promotionId } });
            await expectErrorResponse(res, 400, 'INVALID_DISCOUNT_PERCENT');
        });
    });

    describe('DELETE /api/dashboard/branches/[branchId]/promotions/[promotionId]', () => {
        test('должен успешно удалить акцию', async () => {
            // Мокаем проверку акции
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: promotionId,
                        branch_id: branchId,
                        biz_id: bizId,
                        promotion_type: 'free_after_n_visits',
                    },
                    error: null,
                }),
            });

            // Мокаем удаление акции
            mockAdmin.from.mockReturnValueOnce({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions/${promotionId}`, {
                method: 'DELETE',
            });

            const res = await DELETE(req, { params: { branchId, promotionId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });

        test('должен вернуть 404 если акция не найдена', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions/${promotionId}`, {
                method: 'DELETE',
            });

            const res = await DELETE(req, { params: { branchId, promotionId } });
            await expectErrorResponse(res, 404, 'PROMOTION_NOT_FOUND_OR_ACCESS_DENIED');
        });
    });
});

