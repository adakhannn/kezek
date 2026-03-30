/**
 * Тесты для /api/admin/promotions/debug
 * Отладочная информация о промоакциях
 */

import { GET } from '@/app/api/admin/promotions/debug/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

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

describe('/api/admin/promotions/debug', () => {
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

            const req = createMockRequest('http://localhost/api/admin/promotions/debug?clientId=client-id', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 401);
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
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/admin/promotions/debug?clientId=client-id', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 403);
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии параметров', async () => {
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
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        roles: {
                            key: 'super_admin',
                        },
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/admin/promotions/debug', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при невалидном формате UUID', async () => {
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
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        roles: {
                            key: 'super_admin',
                        },
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/admin/promotions/debug?clientId=invalid-uuid', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешное получение отладочной информации', () => {
        test('должен успешно вернуть отладочную информацию по clientId', async () => {
            const clientId = '123e4567-e89b-12d3-a456-426614174000';

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
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        roles: {
                            key: 'super_admin',
                        },
                    },
                    error: null,
                }),
            });

            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'profiles') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: clientId,
                                email: 'client@example.com',
                                phone: '+996555123456',
                                full_name: 'Client Name',
                            },
                            error: null,
                        }),
                    };
                }

                if (table === 'client_promotion_usage') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        order: jest.fn().mockReturnThis(),
                        limit: jest.fn().mockResolvedValue({
                            data: [],
                            error: null,
                        }),
                    };
                }

                if (table === 'client_referrals') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        or: jest.fn().mockReturnThis(),
                        order: jest.fn().mockReturnThis(),
                        limit: jest.fn().mockResolvedValue({
                            data: [],
                            error: null,
                        }),
                    };
                }

                if (table === 'bookings') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        not: jest.fn().mockReturnThis(),
                        order: jest.fn().mockReturnThis(),
                        limit: jest.fn().mockResolvedValue({
                            data: [],
                            error: null,
                        }),
                    };
                }

                if (table === 'branch_promotions') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        data: [],
                        error: null,
                    };
                }

                return mockAdmin;
            });

            const req = createMockRequest(`http://localhost/api/admin/promotions/debug?clientId=${clientId}`, {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('client');
        });
    });
});


