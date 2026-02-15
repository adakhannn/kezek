/**
 * Тесты для /api/staff/create-from-user
 * Создание сотрудника из существующего пользователя
 */

import { POST } from '@/app/api/staff/create-from-user/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

jest.mock('@/lib/staffSchedule', () => ({
    initializeStaffSchedule: jest.fn().mockResolvedValue(undefined),
}));

describe('/api/staff/create-from-user', () => {
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';
    const branchId = 'branch-uuid';
    const userId = 'user-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии обязательных полей', async () => {
            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {},
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'INVALID_BODY');
        });

        test('должен вернуть 400 при отсутствии user_id', async () => {
            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {
                    branch_id: branchId,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'INVALID_BODY');
        });

        test('должен вернуть 400 при отсутствии branch_id', async () => {
            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {
                    user_id: userId,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'INVALID_BODY');
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 400 если филиал не принадлежит бизнесу', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

            // Мокаем список пользователей
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [
                        {
                            id: userId,
                            email: 'test@example.com',
                            phone: '+996555123456',
                            user_metadata: { full_name: 'Test User' },
                        },
                    ],
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {
                    user_id: userId,
                    branch_id: branchId,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'BRANCH_NOT_IN_THIS_BUSINESS');
        });

        test('должен вернуть 404 если пользователь не найден', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: branchId,
                    biz_id: bizId,
                },
                error: null,
            });

            // Мокаем список пользователей (пользователь не найден)
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [],
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {
                    user_id: 'non-existent-user',
                    branch_id: branchId,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 404, 'USER_NOT_FOUND');
        });
    });

    describe('Успешное создание', () => {
        test('должен успешно создать сотрудника из пользователя', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: branchId,
                    biz_id: bizId,
                },
                error: null,
            });

            // Мокаем список пользователей
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [
                        {
                            id: userId,
                            email: 'test@example.com',
                            phone: '+996555123456',
                            user_metadata: { full_name: 'Test User' },
                        },
                    ],
                },
                error: null,
            });

            // Мокаем проверку существующего сотрудника
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null, // Сотрудник не существует
                    error: null,
                }),
            });

            // Мокаем создание сотрудника
            mockAdmin.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        id: 'staff-id',
                    },
                    error: null,
                }),
            });

            // Мокаем создание назначения на филиал
            mockAdmin.from.mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {
                    user_id: userId,
                    branch_id: branchId,
                    is_active: true,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('staff_id');
        });

        test('должен использовать существующего сотрудника если он уже есть', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: branchId,
                    biz_id: bizId,
                },
                error: null,
            });

            // Мокаем список пользователей
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [
                        {
                            id: userId,
                            email: 'test@example.com',
                            phone: '+996555123456',
                            user_metadata: { full_name: 'Test User' },
                        },
                    ],
                },
                error: null,
            });

            // Мокаем проверку существующего сотрудника (найден)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'existing-staff-id',
                    },
                    error: null,
                }),
            });

            // Мокаем проверку user_id существующего сотрудника
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        user_id: null, // user_id еще не установлен
                    },
                    error: null,
                }),
            });

            // Мокаем обновление user_id
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем создание назначения на филиал
            mockAdmin.from.mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {
                    user_id: userId,
                    branch_id: branchId,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('staff_id', 'existing-staff-id');
        });
    });
});

