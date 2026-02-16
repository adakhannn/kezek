/**
 * Тесты для /api/services/[id]/delete
 * Удаление услуги
 */

import { POST } from '@/app/api/services/[id]/delete/route';
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

describe('/api/services/[id]/delete', () => {
    const mockAdmin = createMockSupabase();
    const serviceId = 'service-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        (getRouteParamRequired as jest.Mock).mockResolvedValue(serviceId);
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 404 если услуга не найдена', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

            const req = createMockRequest(`http://localhost/api/services/${serviceId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: serviceId } });
            await expectErrorResponse(res, 404);
        });

        test('должен вернуть 403 если услуга принадлежит другому бизнесу', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource belongs to different business',
            });

            const req = createMockRequest(`http://localhost/api/services/${serviceId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: serviceId } });
            await expectErrorResponse(res, 403);
        });
    });

    describe('Проверка будущих броней', () => {
        test('должен вернуть 400 если есть будущие активные брони', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: serviceId,
                    biz_id: bizId,
                },
                error: null,
            });

            // Мокаем проверку будущих броней
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [
                        { id: 'booking-1', status: 'confirmed', start_at: '2025-12-31T10:00:00Z', client_name: 'Client 1' },
                        { id: 'booking-2', status: 'confirmed', start_at: '2025-12-31T11:00:00Z', client_name: 'Client 2' },
                    ],
                    count: 5, // Есть будущие брони
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/services/${serviceId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: serviceId } });
            await expectErrorResponse(res, 400, 'HAS_BOOKINGS');
        });
    });

    describe('Успешное удаление', () => {
        test('должен успешно удалить услугу без будущих броней', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: serviceId,
                    biz_id: bizId,
                },
                error: null,
            });

            // Мокаем проверку будущих броней (нет броней)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [],
                    count: 0, // Нет будущих броней
                    error: null,
                }),
            });

            // Мокаем удаление прошедших броней
            mockAdmin.from.mockReturnValueOnce({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lt: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем удаление услуги
            mockAdmin.from.mockReturnValueOnce({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/services/${serviceId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: serviceId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });

        test('должен успешно удалить услугу с прошедшими бронями', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: serviceId,
                    biz_id: bizId,
                },
                error: null,
            });

            // Мокаем проверку будущих броней (нет будущих, но есть прошедшие)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [],
                    count: 0, // Нет будущих броней
                    error: null,
                }),
            });

            // Мокаем удаление прошедших броней
            mockAdmin.from.mockReturnValueOnce({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lt: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем удаление услуги
            mockAdmin.from.mockReturnValueOnce({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest(`http://localhost/api/services/${serviceId}/delete`, {
                method: 'POST',
            });

            const res = await POST(req, { params: { id: serviceId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});


