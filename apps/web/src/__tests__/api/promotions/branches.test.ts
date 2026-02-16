/**
 * Тесты для /api/dashboard/branches/[branchId]/promotions
 * Управление акциями филиала
 */

import { GET, POST } from '@/app/api/dashboard/branches/[branchId]/promotions/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';
import { getRouteParamUuid } from '@/lib/routeParams';

// Мокаем authBiz
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

// Мокаем supabaseService
jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

// Мокаем routeParams
jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

describe('/api/dashboard/branches/[branchId]/promotions', () => {
    const mockAdmin = createMockSupabase();
    const branchId = 'branch-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamUuid as jest.Mock).mockResolvedValue(branchId);
    });

    describe('GET /api/dashboard/branches/[branchId]/promotions', () => {
        test('должен вернуть список акций филиала', async () => {
            // Мокаем проверку филиала
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: branchId,
                        biz_id: bizId,
                    },
                    error: null,
                }),
            });

            // Мокаем получение акций
            const mockPromotions = [
                {
                    id: 'promo-1',
                    promotion_type: 'free_after_n_visits',
                    title_ru: 'Акция 1',
                    is_active: true,
                },
                {
                    id: 'promo-2',
                    promotion_type: 'birthday_discount',
                    title_ru: 'Акция 2',
                    is_active: false,
                },
            ];

            let callCount = 0;
            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'branches') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: branchId,
                                biz_id: bizId,
                            },
                            error: null,
                        }),
                    };
                } else if (table === 'branch_promotions') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        order: jest.fn().mockResolvedValue({
                            data: mockPromotions,
                            error: null,
                        }),
                    };
                } else if (table === 'client_promotion_usage') {
                    callCount++;
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        mockResolvedValue: {
                            count: callCount === 1 ? 5 : 10,
                            error: null,
                        },
                    };
                }
                return mockAdmin;
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { branchId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('promotions');
            expect(Array.isArray(data.promotions)).toBe(true);
        });

        test('должен вернуть 404 если филиал не найден', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { branchId } });
            await expectErrorResponse(res, 404, 'BRANCH_NOT_FOUND_OR_ACCESS_DENIED');
        });

        test('должен вернуть 404 если филиал принадлежит другому бизнесу', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: branchId,
                        biz_id: 'other-biz-id',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { branchId } });
            await expectErrorResponse(res, 404, 'BRANCH_NOT_FOUND_OR_ACCESS_DENIED');
        });
    });

    describe('POST /api/dashboard/branches/[branchId]/promotions', () => {
        test('должен успешно создать акцию типа free_after_n_visits', async () => {
            // Мокаем проверку филиала
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: branchId,
                        biz_id: bizId,
                    },
                    error: null,
                }),
            });

            // Мокаем создание акции
            const mockPromotion = {
                id: 'promo-id',
                branch_id: branchId,
                biz_id: bizId,
                promotion_type: 'free_after_n_visits',
                params: { visit_count: 7 },
                title_ru: 'Бесплатно после 7 визитов',
                is_active: true,
            };

            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'branches') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: branchId,
                                biz_id: bizId,
                            },
                            error: null,
                        }),
                    };
                } else if (table === 'branch_promotions') {
                    return {
                        insert: jest.fn().mockReturnThis(),
                        select: jest.fn().mockReturnThis(),
                        single: jest.fn().mockResolvedValue({
                            data: mockPromotion,
                            error: null,
                        }),
                    };
                }
                return mockAdmin;
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
                method: 'POST',
                body: {
                    promotion_type: 'free_after_n_visits',
                    params: { visit_count: 7 },
                    title_ru: 'Бесплатно после 7 визитов',
                    is_active: true,
                },
            });

            const res = await POST(req, { params: { branchId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('promotion');
            expect(data.promotion).toHaveProperty('promotion_type', 'free_after_n_visits');
        });

        test('должен вернуть 400 при отсутствии обязательных полей', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: branchId,
                        biz_id: bizId,
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
                method: 'POST',
                body: {
                    // Отсутствует promotion_type или title_ru
                },
            });

            const res = await POST(req, { params: { branchId } });
            await expectErrorResponse(res, 400, 'MISSING_REQUIRED_FIELDS');
        });

        test('должен вернуть 400 при невалидном visit_count для free_after_n_visits', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: branchId,
                        biz_id: bizId,
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
                method: 'POST',
                body: {
                    promotion_type: 'free_after_n_visits',
                    params: { visit_count: 0 }, // Невалидное значение
                    title_ru: 'Test',
                },
            });

            const res = await POST(req, { params: { branchId } });
            await expectErrorResponse(res, 400, 'INVALID_VISIT_COUNT');
        });

        test('должен вернуть 400 при невалидном discount_percent', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: branchId,
                        biz_id: bizId,
                    },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
                method: 'POST',
                body: {
                    promotion_type: 'birthday_discount',
                    params: { discount_percent: 150 }, // Невалидное значение (>100)
                    title_ru: 'Test',
                },
            });

            const res = await POST(req, { params: { branchId } });
            await expectErrorResponse(res, 400, 'INVALID_DISCOUNT_PERCENT');
        });

        test('должен вернуть 404 если филиал не найден', async () => {
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
                method: 'POST',
                body: {
                    promotion_type: 'free_after_n_visits',
                    params: { visit_count: 7 },
                    title_ru: 'Test',
                },
            });

            const res = await POST(req, { params: { branchId } });
            await expectErrorResponse(res, 404, 'BRANCH_NOT_FOUND_OR_ACCESS_DENIED');
        });
    });
});


