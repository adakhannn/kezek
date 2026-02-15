/**
 * Тесты для /api/admin/performance/stats
 * Статистика производительности операций
 */

import { GET } from '@/app/api/admin/performance/stats/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { getServiceClient } from '@/lib/supabaseService';
import { getPerformanceStats, getOperations } from '@/lib/performance';

// Мокаем зависимости
jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/performance', () => ({
    getPerformanceStats: jest.fn(),
    getOperations: jest.fn(),
}));

describe('/api/admin/performance/stats', () => {
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Авторизация', () => {
        test('должен вернуть 401 если пользователь не авторизован', async () => {
            mockAdmin.auth.getUser.mockResolvedValue({
                data: {
                    user: null,
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/admin/performance/stats', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 401);
        });

        test('должен вернуть 403 если пользователь не суперадмин', async () => {
            mockAdmin.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            // Мокаем проверку профиля (не суперадмин)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        is_super_admin: false,
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/admin/performance/stats', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 403);
        });
    });

    describe('Успешное получение статистики', () => {
        test('должен успешно вернуть статистику производительности', async () => {
            mockAdmin.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            // Мокаем проверку профиля (суперадмин)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        is_super_admin: true,
                    },
                    error: null,
                }),
            });

            // Мокаем получение операций
            (getOperations as jest.Mock).mockReturnValue(['operation1', 'operation2']);

            // Мокаем получение статистики для каждой операции
            (getPerformanceStats as jest.Mock)
                .mockReturnValueOnce({
                    count: 10,
                    avgTime: 100,
                    minTime: 50,
                    maxTime: 200,
                })
                .mockReturnValueOnce({
                    count: 5,
                    avgTime: 150,
                    minTime: 100,
                    maxTime: 250,
                });

            const req = createMockRequest('http://localhost/api/admin/performance/stats', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('stats');
            expect(data).toHaveProperty('timestamp');
            expect((data as { stats: unknown[] }).stats.length).toBe(2);
        });
    });
});

