/**
 * API-тесты: планы пакетов визитов
 * GET/POST /api/dashboard/visit-package-plans, PATCH /api/dashboard/visit-package-plans/[id]
 * Права доступа, валидация, создание и редактирование плана.
 */

import { GET, POST } from '@/app/api/dashboard/visit-package-plans/route';
import { PATCH } from '@/app/api/dashboard/visit-package-plans/[id]/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { getRouteParamUuid } from '@/lib/routeParams';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

describe('/api/dashboard/visit-package-plans', () => {
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';
    const planId = 'plan-uuid';

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: {},
            userId: 'user-uuid',
            bizId,
        });
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('GET /api/dashboard/visit-package-plans', () => {
        test('должен вернуть список планов бизнеса', async () => {
            const mockPlans = [
                {
                    id: planId,
                    biz_id: bizId,
                    name_ru: 'Пакет 5 визитов',
                    name_ky: null,
                    name_en: null,
                    visit_count: 5,
                    validity_days: 90,
                    discount_type: 'percent',
                    discount_value: 20,
                    service_id: null,
                    branch_ids: null,
                    is_active: true,
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                },
            ];
            mockAdmin.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: mockPlans, error: null }),
            });

            const req = createMockRequest('http://localhost/api/dashboard/visit-package-plans', { method: 'GET' });
            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data.data).toHaveProperty('plans');
            expect(Array.isArray(data.data.plans)).toBe(true);
            expect(data.data.plans[0]).toHaveProperty('name_ru', 'Пакет 5 визитов');
            expect(data.data.plans[0]).toHaveProperty('visit_count', 5);
        });

        test('должен вернуть 401 при отсутствии авторизации', async () => {
            const { BizAccessError } = await import('@/lib/authDiagnostics');
            (getBizContextForManagers as jest.Mock).mockRejectedValue(new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED'));

            const req = createMockRequest('http://localhost/api/dashboard/visit-package-plans', { method: 'GET' });
            const res = await GET(req);
            await expectErrorResponse(res, 401, 'auth');
        });

        test('должен вернуть 403 при отсутствии доступа к бизнесу', async () => {
            const { BizAccessError } = await import('@/lib/authDiagnostics');
            (getBizContextForManagers as jest.Mock).mockRejectedValue(new BizAccessError('NO_BIZ_ACCESS'));

            const req = createMockRequest('http://localhost/api/dashboard/visit-package-plans', { method: 'GET' });
            const res = await GET(req);
            await expectErrorResponse(res, 403, 'forbidden');
        });
    });

    describe('POST /api/dashboard/visit-package-plans', () => {
        test('должен успешно создать план пакета', async () => {
            const created = {
                id: planId,
                name_ru: 'Пакет 10 визитов',
                visit_count: 10,
                validity_days: 180,
                discount_type: 'fixed_price',
                discount_value: 5000,
                is_active: true,
                created_at: '2024-01-01T00:00:00Z',
            };
            mockAdmin.from.mockReturnValue({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: created, error: null }),
            });

            const req = createMockRequest('http://localhost/api/dashboard/visit-package-plans', {
                method: 'POST',
                body: {
                    name_ru: 'Пакет 10 визитов',
                    visit_count: 10,
                    validity_days: 180,
                    discount_type: 'fixed_price',
                    discount_value: 5000,
                },
            });
            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data.data).toHaveProperty('plan');
            expect(data.data.plan).toHaveProperty('id', planId);
            expect(data.data.plan).toHaveProperty('name_ru', 'Пакет 10 визитов');
            expect(data.data.plan).toHaveProperty('visit_count', 10);
        });

        test('должен вернуть 400 при невалидном body (отсутствует name_ru)', async () => {
            const req = createMockRequest('http://localhost/api/dashboard/visit-package-plans', {
                method: 'POST',
                body: {
                    visit_count: 5,
                    validity_days: 90,
                    discount_type: 'percent',
                    discount_value: 10,
                },
            });
            const res = await POST(req);
            await expectErrorResponse(res, 400, 'validation');
        });

        test('должен вернуть 400 при percent и discount_value > 100', async () => {
            const req = createMockRequest('http://localhost/api/dashboard/visit-package-plans', {
                method: 'POST',
                body: {
                    name_ru: 'Пакет',
                    visit_count: 5,
                    validity_days: 90,
                    discount_type: 'percent',
                    discount_value: 150,
                },
            });
            const res = await POST(req);
            await expectErrorResponse(res, 400, 'validation');
        });
    });

    describe('PATCH /api/dashboard/visit-package-plans/[id]', () => {
        beforeEach(() => {
            (getRouteParamUuid as jest.Mock).mockResolvedValue(planId);
        });

        test('должен успешно обновить план', async () => {
            mockAdmin.from
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: planId, biz_id: bizId },
                        error: null,
                    }),
                })
                .mockReturnValueOnce({
                    update: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    select: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: {
                            id: planId,
                            name_ru: 'Обновлённый пакет',
                            is_active: false,
                            updated_at: '2024-01-02T00:00:00Z',
                        },
                        error: null,
                    }),
                });

            const req = createMockRequest(`http://localhost/api/dashboard/visit-package-plans/${planId}`, {
                method: 'PATCH',
                body: { name_ru: 'Обновлённый пакет', is_active: false },
            });
            const res = await PATCH(req, { params: Promise.resolve({ id: planId }) });
            const data = await expectSuccessResponse(res, 200);

            expect(data.data).toHaveProperty('plan');
            expect(data.data.plan).toHaveProperty('name_ru', 'Обновлённый пакет');
            expect(data.data.plan).toHaveProperty('is_active', false);
        });

        test('должен вернуть 404 если план не найден или не принадлежит бизнесу', async () => {
            mockAdmin.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/visit-package-plans/${planId}`, {
                method: 'PATCH',
                body: { name_ru: 'Новое имя' },
            });
            const res = await PATCH(req, { params: Promise.resolve({ id: planId }) });
            await expectErrorResponse(res, 404, 'not_found');
        });

        test('должен вернуть 400 при невалидном body для PATCH', async () => {
            mockAdmin.from.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: planId, biz_id: bizId }, error: null }),
            });

            const req = createMockRequest(`http://localhost/api/dashboard/visit-package-plans/${planId}`, {
                method: 'PATCH',
                body: { visit_count: -1 },
            });
            const res = await PATCH(req, { params: Promise.resolve({ id: planId }) });
            await expectErrorResponse(res, 400, 'validation');
        });
    });
});
