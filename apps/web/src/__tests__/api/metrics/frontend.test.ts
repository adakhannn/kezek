/**
 * Тесты для /api/metrics/frontend
 * Сохранение метрик производительности фронтенда
 */

import { POST } from '@/app/api/metrics/frontend/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/apiMetrics', () => ({
    getIpAddress: jest.fn().mockReturnValue('127.0.0.1'),
}));

describe('/api/metrics/frontend', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Успешное сохранение метрик', () => {
        test('должен успешно сохранить Web Vitals метрику', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            // Мокаем RPC функцию
            mockAdmin.rpc.mockResolvedValue({
                data: null,
                error: null,
            });

            const metric = {
                name: 'LCP',
                value: 1200,
                rating: 'good' as const,
                delta: 100,
                id: 'metric-id',
                navigationType: 'navigate',
                url: '/test',
                timestamp: Date.now(),
            };

            const req = createMockRequest('http://localhost/api/metrics/frontend', {
                method: 'POST',
                body: metric,
                headers: {
                    'user-agent': 'Mozilla/5.0',
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(mockAdmin.rpc).toHaveBeenCalledWith('log_frontend_metric', expect.objectContaining({
                p_metric_type: 'web-vitals',
            }));
        });

        test('должен успешно сохранить Page Load метрику', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: null, // Не авторизован
                },
                error: null,
            });

            // Мокаем RPC функцию
            mockAdmin.rpc.mockResolvedValue({
                data: null,
                error: null,
            });

            const metric = {
                page: '/dashboard',
                loadTime: 2000,
                domInteractive: 1500,
                domComplete: 1800,
                firstPaint: 1000,
                firstContentfulPaint: 1200,
                timeToFirstByte: 500,
                timestamp: Date.now(),
            };

            const req = createMockRequest('http://localhost/api/metrics/frontend', {
                method: 'POST',
                body: metric,
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(mockAdmin.rpc).toHaveBeenCalledWith('log_frontend_metric', expect.objectContaining({
                p_metric_type: 'page-load',
            }));
        });

        test('должен успешно сохранить Render метрику', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            // Мокаем RPC функцию
            mockAdmin.rpc.mockResolvedValue({
                data: null,
                error: null,
            });

            const metric = {
                page: '/test',
                renderTime: 500,
                componentCount: 25,
                timestamp: Date.now(),
            };

            const req = createMockRequest('http://localhost/api/metrics/frontend', {
                method: 'POST',
                body: metric,
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(mockAdmin.rpc).toHaveBeenCalledWith('log_frontend_metric', expect.objectContaining({
                p_metric_type: 'render',
            }));
        });

        test('должен обработать ошибку RPC функции без прерывания', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            // Мокаем ошибку RPC функции
            mockAdmin.rpc.mockResolvedValue({
                data: null,
                error: {
                    message: 'Function not found',
                },
            });

            const metric = {
                name: 'CLS',
                value: 0.1,
                rating: 'good' as const,
                delta: 0.05,
                id: 'metric-id',
                navigationType: 'navigate',
                url: '/test',
                timestamp: Date.now(),
            };

            const req = createMockRequest('http://localhost/api/metrics/frontend', {
                method: 'POST',
                body: metric,
            });

            // Даже при ошибке RPC функция должна вернуть успех
            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});

