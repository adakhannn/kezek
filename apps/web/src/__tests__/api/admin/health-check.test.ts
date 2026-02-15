/**
 * Тесты для /api/admin/health-check
 * Комплексная проверка здоровья системы
 */

import { GET } from '@/app/api/admin/health-check/route';
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

describe('/api/admin/health-check', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Авторизация', () => {
        test('должен вернуть 401 если пользователь не авторизован', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: null,
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/admin/health-check', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 401, 'UNAUTHORIZED');
        });

        test('должен вернуть 403 если пользователь не суперадмин', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            // Мокаем проверку роли (не суперадмин)
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/admin/health-check', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Успешная проверка здоровья', () => {
        test('должен успешно вернуть результаты проверки здоровья', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            // Мокаем проверку роли (суперадмин)
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        role_key: 'super_admin',
                        biz_id: null,
                    },
                    error: null,
                }),
            });

            // Мокаем проверку открытых смен
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lt: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });

            // Мокаем проверку метрик рейтингов
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        metric_date: '2024-01-15',
                    },
                    error: null,
                }),
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        metric_date: '2024-01-15',
                    },
                    error: null,
                }),
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        metric_date: '2024-01-15',
                    },
                    error: null,
                }),
            });

            // Мокаем проверку промоакций
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        applied_at: '2024-01-15',
                    },
                    error: null,
                }),
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockResolvedValue({
                    count: 5,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/admin/health-check', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('alerts');
            expect(data).toHaveProperty('checks');
            expect((data as { checks: unknown }).checks).toHaveProperty('shifts');
            expect((data as { checks: unknown }).checks).toHaveProperty('ratings');
            expect((data as { checks: unknown }).checks).toHaveProperty('promotions');
        });
    });
});

