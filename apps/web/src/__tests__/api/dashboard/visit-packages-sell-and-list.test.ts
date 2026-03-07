/**
 * API-тесты: продажа пакета клиенту и список проданных пакетов
 * POST /api/dashboard/clients/[clientId]/visit-packages, GET /api/dashboard/visit-packages
 * Права доступа, валидация, список с фильтрами.
 */

import { POST } from '@/app/api/dashboard/clients/[clientId]/visit-packages/route';
import { GET } from '@/app/api/dashboard/visit-packages/route';
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

const validPlanId = '550e8400-e29b-41d4-a716-446655440001';
const validClientId = '550e8400-e29b-41d4-a716-446655440002';

describe('POST /api/dashboard/clients/[clientId]/visit-packages', () => {
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';
    const clientId = validClientId;
    const planId = validPlanId;

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: {},
            userId: 'user-uuid',
            bizId,
        });
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
        (getRouteParamUuid as jest.Mock).mockResolvedValue(clientId);
    });

    test('должен успешно продать пакет клиенту', async () => {
        const plan = {
            id: planId,
            biz_id: bizId,
            visit_count: 5,
            validity_days: 90,
            is_active: true,
        };
        const sold = {
            id: 'sold-pkg-uuid',
            client_id: clientId,
            plan_id: planId,
            remaining_visits: 5,
            valid_until: '2025-06-01',
            purchased_at: '2024-01-01T12:00:00Z',
            created_at: '2024-01-01T12:00:00Z',
        };
        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: plan, error: null }),
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: sold, error: null }),
            });

        const req = createMockRequest(`http://localhost/api/dashboard/clients/${clientId}/visit-packages`, {
            method: 'POST',
            body: { plan_id: planId },
        });
        const res = await POST(req, { params: Promise.resolve({ clientId }) });
        const data = await expectSuccessResponse(res, 200);

        expect(data.data).toHaveProperty('package');
        expect(data.data.package).toHaveProperty('client_id', clientId);
        expect(data.data.package).toHaveProperty('plan_id', planId);
        expect(data.data.package).toHaveProperty('remaining_visits', 5);
    });

    test('должен вернуть 404 если план не найден или не принадлежит бизнесу', async () => {
        mockAdmin.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        const req = createMockRequest(`http://localhost/api/dashboard/clients/${clientId}/visit-packages`, {
            method: 'POST',
            body: { plan_id: planId },
        });
        const res = await POST(req, { params: Promise.resolve({ clientId }) });
        await expectErrorResponse(res, 404, 'not_found');
    });

    test('должен вернуть 400 если план деактивирован', async () => {
        mockAdmin.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: planId, biz_id: bizId, visit_count: 5, validity_days: 90, is_active: false },
                error: null,
            }),
        });

        const req = createMockRequest(`http://localhost/api/dashboard/clients/${clientId}/visit-packages`, {
            method: 'POST',
            body: { plan_id: planId },
        });
        const res = await POST(req, { params: Promise.resolve({ clientId }) });
        await expectErrorResponse(res, 400, 'validation');
    });

    test('должен вернуть 400 при невалидном plan_id (не UUID)', async () => {
        const req = createMockRequest(`http://localhost/api/dashboard/clients/${clientId}/visit-packages`, {
            method: 'POST',
            body: { plan_id: 'not-a-uuid' },
        });
        const res = await POST(req, { params: Promise.resolve({ clientId }) });
        await expectErrorResponse(res, 400, 'validation');
    });

    test('должен вернуть 401 при отсутствии авторизации', async () => {
        const { BizAccessError } = await import('@/lib/authDiagnostics');
        (getBizContextForManagers as jest.Mock).mockRejectedValue(new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED'));

        const req = createMockRequest(`http://localhost/api/dashboard/clients/${clientId}/visit-packages`, {
            method: 'POST',
            body: { plan_id: planId },
        });
        const res = await POST(req, { params: Promise.resolve({ clientId }) });
        await expectErrorResponse(res, 401, 'auth');
    });
});

describe('GET /api/dashboard/visit-packages', () => {
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: {},
            userId: 'user-uuid',
            bizId,
        });
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    test('должен вернуть список проданных пакетов', async () => {
        const planRows = [
            {
                id: 'plan-1',
                name_ru: 'Пакет 5 визитов',
                name_ky: null,
                name_en: null,
                visit_count: 5,
                branch_ids: null,
            },
        ];
        const packageRows = [
            {
                id: 'pkg-1',
                client_id: 'client-1',
                plan_id: 'plan-1',
                remaining_visits: 3,
                valid_until: '2025-12-31',
                purchased_at: '2024-01-01T00:00:00Z',
                created_at: '2024-01-01T00:00:00Z',
            },
        ];
        const profiles = [{ id: 'client-1', full_name: 'Иван Иванов' }];
        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: planRows, error: null }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: packageRows, error: null }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockResolvedValue({ data: profiles, error: null }),
            });

        const req = createMockRequest('http://localhost/api/dashboard/visit-packages', { method: 'GET' });
        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.data).toHaveProperty('packages');
        expect(Array.isArray(data.data.packages)).toBe(true);
        expect(data.data.packages[0]).toHaveProperty('remaining_visits', 3);
        expect(data.data.packages[0]).toHaveProperty('client_name', 'Иван Иванов');
    });

    test('должен вернуть пустой список если у бизнеса нет планов', async () => {
        mockAdmin.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        });

        const req = createMockRequest('http://localhost/api/dashboard/visit-packages', { method: 'GET' });
        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.data).toHaveProperty('packages');
        expect(data.data.packages).toEqual([]);
    });

    test('должен принять query status=active и отфильтровать', async () => {
        const planRows = [{ id: 'plan-1', name_ru: 'П', name_ky: null, name_en: null, visit_count: 5, branch_ids: null }];
        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: planRows, error: null }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                gt: jest.fn().mockResolvedValue({ data: [], error: null }),
            });

        const req = createMockRequest('http://localhost/api/dashboard/visit-packages?status=active', { method: 'GET' });
        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);
        expect(data.data).toHaveProperty('packages');
    });

    test('должен вернуть 403 при отсутствии доступа к бизнесу', async () => {
        const { BizAccessError } = await import('@/lib/authDiagnostics');
        (getBizContextForManagers as jest.Mock).mockRejectedValue(new BizAccessError('NO_BIZ_ACCESS'));

        const req = createMockRequest('http://localhost/api/dashboard/visit-packages', { method: 'GET' });
        const res = await GET(req);
        await expectErrorResponse(res, 403, 'forbidden');
    });
});
