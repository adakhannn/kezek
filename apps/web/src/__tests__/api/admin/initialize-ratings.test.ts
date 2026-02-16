/**
 * Тесты для /api/admin/initialize-ratings
 * Инициализация рейтингов для всех бизнесов, филиалов и сотрудников
 */

import { POST } from '@/app/api/admin/initialize-ratings/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(),
}));

jest.mock('next/headers', () => ({
    cookies: jest.fn().mockResolvedValue({
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
    }),
}));

describe('/api/admin/initialize-ratings', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);

        const { createServerClient } = require('@supabase/ssr');
        createServerClient.mockReturnValue(mockSupabase);
    });

    describe('Авторизация', () => {
        test('должен вернуть 401 если пользователь не авторизован', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: null,
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/admin/initialize-ratings', {
                method: 'POST',
            });

            const res = await POST(req);
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

            const req = createMockRequest('http://localhost/api/admin/initialize-ratings', {
                method: 'POST',
            });

            const res = await POST(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Успешная инициализация', () => {
        test('должен успешно инициализировать рейтинги', async () => {
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

            // Мокаем вызов RPC функции
            mockAdmin.rpc.mockResolvedValue({
                data: { initialized: true },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/admin/initialize-ratings', {
                method: 'POST',
                body: {
                    days_back: 30,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('message');
            expect(mockAdmin.rpc).toHaveBeenCalledWith('initialize_all_ratings', {
                p_days_back: 30,
            });
        });

        test('должен использовать значение по умолчанию для days_back', async () => {
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

            // Мокаем вызов RPC функции
            mockAdmin.rpc.mockResolvedValue({
                data: { initialized: true },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/admin/initialize-ratings', {
                method: 'POST',
                body: {},
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            // Должен использовать значение по умолчанию 30
            expect(mockAdmin.rpc).toHaveBeenCalledWith('initialize_all_ratings', {
                p_days_back: 30,
            });
        });
    });
});


