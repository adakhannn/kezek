/**
 * Тесты для /api/services/[id]/update
 * Обновление услуги
 */

import { POST } from '@/app/api/services/[id]/update/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamRequired: jest.fn(),
}));

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

describe('/api/services/[id]/update', () => {
    const mockAdmin = createMockSupabase();
    const serviceId = 'service-uuid';
    const bizId = 'biz-uuid';
    const branchId = 'branch-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamRequired as jest.Mock).mockResolvedValue(serviceId);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии name_ru', async () => {
            const req = createMockRequest(`http://localhost/api/services/${serviceId}/update`, {
                method: 'POST',
                body: {
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 2000,
                    active: true,
                    branch_ids: [branchId],
                },
            });

            const res = await POST(req, { params: { id: serviceId } });
            await expectErrorResponse(res, 400, 'NAME_REQUIRED');
        });

        test('должен вернуть 400 при невалидном duration_min', async () => {
            const req = createMockRequest(`http://localhost/api/services/${serviceId}/update`, {
                method: 'POST',
                body: {
                    name_ru: 'Test Service',
                    duration_min: 0, // Невалидное значение
                    price_from: 1000,
                    price_to: 2000,
                    active: true,
                    branch_ids: [branchId],
                },
            });

            const res = await POST(req, { params: { id: serviceId } });
            await expectErrorResponse(res, 400, 'DURATION_INVALID');
        });

        test('должен вернуть 400 при отсутствии branch_ids', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: serviceId,
                    biz_id: bizId,
                    name_ru: 'Test Service',
                },
                error: null,
            });

            const req = createMockRequest(`http://localhost/api/services/${serviceId}/update`, {
                method: 'POST',
                body: {
                    name_ru: 'Test Service',
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 2000,
                    active: true,
                    // Отсутствует branch_ids
                },
            });

            const res = await POST(req, { params: { id: serviceId } });
            await expectErrorResponse(res, 400, 'BRANCH_REQUIRED');
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 400 если услуга не принадлежит бизнесу', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

            const req = createMockRequest(`http://localhost/api/services/${serviceId}/update`, {
                method: 'POST',
                body: {
                    name_ru: 'Test Service',
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 2000,
                    active: true,
                    branch_ids: [branchId],
                },
            });

            const res = await POST(req, { params: { id: serviceId } });
            await expectErrorResponse(res, 400, 'SERVICE_NOT_IN_THIS_BUSINESS');
        });

        test('должен вернуть 400 если филиал не принадлежит бизнесу', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: serviceId,
                    biz_id: bizId,
                    name_ru: 'Test Service',
                },
                error: null,
            });

            // Мокаем проверку филиалов
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockResolvedValue({
                    data: [], // Филиал не найден
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/services/${serviceId}/update`, {
                method: 'POST',
                body: {
                    name_ru: 'Test Service',
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 2000,
                    active: true,
                    branch_ids: ['non-existent-branch'],
                },
            });

            const res = await POST(req, { params: { id: serviceId } });
            await expectErrorResponse(res, 400, 'BRANCH_NOT_IN_THIS_BUSINESS');
        });
    });

    describe('Успешное обновление', () => {
        test('должен успешно обновить услугу', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: serviceId,
                    biz_id: bizId,
                    name_ru: 'Test Service',
                },
                error: null,
            });

            // Мокаем проверку филиалов
            let servicesCallCount = 0;
            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'branches') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        in: jest.fn().mockResolvedValue({
                            data: [{ id: branchId, biz_id: bizId }],
                            error: null,
                        }),
                    };
                } else if (table === 'services') {
                    servicesCallCount++;
                    if (servicesCallCount === 1) {
                        // Поиск существующих услуг
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockResolvedValue({
                                data: [{ id: serviceId, branch_id: branchId }],
                                error: null,
                            }),
                        };
                    } else {
                        // Обновление услуги
                        return {
                            update: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            in: jest.fn().mockResolvedValue({
                                data: { id: serviceId },
                                error: null,
                            }),
                        };
                    }
                }
                return mockAdmin;
            });

            const req = createMockRequest(`http://localhost/api/services/${serviceId}/update`, {
                method: 'POST',
                body: {
                    name_ru: 'Updated Service',
                    name_ky: 'Жаңылалган Кызмат',
                    name_en: 'Updated Service',
                    duration_min: 90,
                    price_from: 1500,
                    price_to: 3000,
                    active: true,
                    branch_ids: [branchId],
                },
            });

            const res = await POST(req, { params: { id: serviceId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});

