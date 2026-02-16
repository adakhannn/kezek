/**
 * Тесты для /api/staff/sync-roles
 * Синхронизация ролей сотрудников
 */

import { POST } from '@/app/api/staff/sync-roles/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/staff/sync-roles', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';
    const userId = 'user-id';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            bizId,
        });

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

            const req = createMockRequest('http://localhost/api/staff/sync-roles', {
                method: 'POST',
            });

            const res = await POST(req);
            await expectErrorResponse(res, 401, 'UNAUTHORIZED');
        });

        test('должен вернуть 403 если пользователь не имеет прав (owner/admin/manager)', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            // Мокаем проверку ролей (нет нужных ролей)
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: [], // Нет ролей owner/admin/manager
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/staff/sync-roles', {
                method: 'POST',
            });

            const res = await POST(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Успешная синхронизация', () => {
        test('должен успешно синхронизировать роли для сотрудников', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            // Мокаем проверку ролей (есть роль owner)
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: [
                        {
                            roles: {
                                key: 'owner',
                            },
                        },
                    ],
                    error: null,
                }),
            });

            // Мокаем получение роли staff
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'staff-role-id',
                    },
                    error: null,
                }),
            });

            // Мокаем получение списка сотрудников
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockResolvedValue({
                    data: [
                        {
                            id: 'staff-1',
                            user_id: 'user-1',
                            full_name: 'Staff 1',
                        },
                        {
                            id: 'staff-2',
                            user_id: 'user-2',
                            full_name: 'Staff 2',
                        },
                    ],
                    error: null,
                }),
            });

            // Мокаем проверку существования роли для каждого сотрудника
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null, // Роль не существует
                    error: null,
                }),
            });

            // Мокаем добавление роли
            mockAdmin.from.mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Второй сотрудник - роль уже существует
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'existing-role-id',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/staff/sync-roles', {
                method: 'POST',
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('synced');
        });

        test('должен вернуть успех если нет сотрудников с user_id', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            // Мокаем проверку ролей
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: [
                        {
                            roles: {
                                key: 'admin',
                            },
                        },
                    ],
                    error: null,
                }),
            });

            // Мокаем получение роли staff
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'staff-role-id',
                    },
                    error: null,
                }),
            });

            // Мокаем получение списка сотрудников (пустой список)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/staff/sync-roles', {
                method: 'POST',
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('synced', 0);
        });
    });
});


