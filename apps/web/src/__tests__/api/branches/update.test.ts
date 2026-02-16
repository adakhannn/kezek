/**
 * Тесты для /api/branches/[id]/update
 * Обновление филиала
 */

import { POST } from '@/app/api/branches/[id]/update/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { validateLatLon } from '@/lib/validation';

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

jest.mock('@/lib/validation', () => ({
    validateLatLon: jest.fn(),
    coordsToEWKT: jest.fn((lat, lon) => `POINT(${lon} ${lat})`),
}));

describe('/api/branches/[id]/update', () => {
    const mockAdmin = createMockSupabase();
    const branchId = 'branch-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamRequired as jest.Mock).mockResolvedValue(branchId);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии name', async () => {
            const req = createMockRequest(`http://localhost/api/branches/${branchId}/update`, {
                method: 'POST',
                body: {
                    is_active: true,
                },
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 400, 'NAME_REQUIRED');
        });

        test('должен вернуть 400 при пустом name', async () => {
            const req = createMockRequest(`http://localhost/api/branches/${branchId}/update`, {
                method: 'POST',
                body: {
                    name: '',
                    is_active: true,
                },
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 400, 'NAME_REQUIRED');
        });

        test('должен вернуть 400 при невалидных координатах', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: branchId,
                    biz_id: bizId,
                },
                error: null,
            });

            (validateLatLon as jest.Mock).mockReturnValue({
                ok: false,
                error: 'Invalid coordinates',
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/update`, {
                method: 'POST',
                body: {
                    name: 'Test Branch',
                    is_active: true,
                    lat: 200, // Невалидная широта
                    lon: 200, // Невалидная долгота
                },
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 400);
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 404 если филиал не найден', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/update`, {
                method: 'POST',
                body: {
                    name: 'Test Branch',
                    is_active: true,
                },
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 404);
        });

        test('должен вернуть 403 если филиал принадлежит другому бизнесу', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource belongs to different business',
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/update`, {
                method: 'POST',
                body: {
                    name: 'Test Branch',
                    is_active: true,
                },
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 403);
        });
    });

    describe('Успешное обновление', () => {
        test('должен успешно обновить филиал', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: branchId,
                    biz_id: bizId,
                },
                error: null,
            });

            // Мокаем обновление филиала
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: { id: branchId },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/update`, {
                method: 'POST',
                body: {
                    name: 'Updated Branch Name',
                    address: 'New Address',
                    is_active: true,
                },
            });

            const res = await POST(req, { params: { id: branchId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });

        test('должен успешно обновить филиал с координатами', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: branchId,
                    biz_id: bizId,
                },
                error: null,
            });

            (validateLatLon as jest.Mock).mockReturnValue({
                ok: true,
                lat: 42.8746,
                lon: 74.5698,
            });

            // Мокаем обновление филиала
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: { id: branchId },
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/update`, {
                method: 'POST',
                body: {
                    name: 'Updated Branch Name',
                    is_active: true,
                    lat: 42.8746,
                    lon: 74.5698,
                },
            });

            const res = await POST(req, { params: { id: branchId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});


