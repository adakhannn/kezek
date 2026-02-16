/**
 * Тесты для /api/admin/ratings/status
 * Статус системы рейтингов
 */

import { GET } from '@/app/api/admin/ratings/status/route';
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

describe('/api/admin/ratings/status', () => {
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

            const req = createMockRequest('http://localhost/api/admin/ratings/status', {
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
                    data: null, // Нет роли super_admin
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/admin/ratings/status', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Успешное получение статуса', () => {
        test('должен успешно вернуть статус системы рейтингов', async () => {
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

            // Мокаем получение последних дат метрик
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

            // Мокаем получение количества записей без рейтинга
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                or: jest.fn().mockResolvedValue({
                    count: 5,
                    error: null,
                }),
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                or: jest.fn().mockResolvedValue({
                    count: 3,
                    error: null,
                }),
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                or: jest.fn().mockResolvedValue({
                    count: 2,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/admin/ratings/status', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('staff_last_metric_date');
            expect(data).toHaveProperty('branch_last_metric_date');
            expect(data).toHaveProperty('biz_last_metric_date');
            expect(data).toHaveProperty('staff_without_rating');
            expect(data).toHaveProperty('branches_without_rating');
            expect(data).toHaveProperty('businesses_without_rating');
        });
    });
});


