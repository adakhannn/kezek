/**
 * Тесты для /api/staff/create
 * Создание нового сотрудника
 */

import { POST } from '@/app/api/staff/create/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем authBiz
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

// Мокаем supabaseService
jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

// Мокаем staffSchedule
jest.mock('@/lib/staffSchedule', () => ({
    initializeStaffSchedule: jest.fn(),
}));

describe('/api/staff/create', () => {
    const mockSupabase = createMockSupabase();
    const mockServiceClient = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            userId: 'user-id',
            bizId: 'biz-id',
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
    });

    describe('Авторизация', () => {
        test('должен вернуть 403 если пользователь не имеет прав', async () => {
            // Пользователь не имеет нужных ролей
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                // Возвращаем пустой массив ролей
            });
            (mockSupabase.from().select().eq as jest.Mock).mockResolvedValue({
                data: [],
                error: null,
            });

            const req = createMockRequest('http://localhost/api/staff/create', {
                method: 'POST',
                body: {
                    full_name: 'Test Staff',
                    branch_id: 'branch-id',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии обязательных полей', async () => {
            // Пользователь имеет права
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
            });
            (mockSupabase.from().select().eq as jest.Mock).mockResolvedValue({
                data: [{ roles: { key: 'owner' } }],
                error: null,
            });

            const req = createMockRequest('http://localhost/api/staff/create', {
                method: 'POST',
                body: {
                    // Отсутствует full_name или branch_id
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'INVALID_BODY');
        });
    });

    describe('Успешное создание', () => {
        test('должен успешно создать сотрудника', async () => {
            // Пользователь имеет права
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
            });
            (mockSupabase.from().select().eq as jest.Mock).mockResolvedValue({
                data: [{ roles: { key: 'owner' } }],
                error: null,
            });

            // Поиск пользователя по email/phone (не найден)
            mockServiceClient.auth = {
                admin: {
                    listUsers: jest.fn().mockResolvedValue({
                        data: { users: [] },
                    }),
                },
            };

            // Создание сотрудника
            mockSupabase.insert.mockResolvedValueOnce({
                data: [{ id: 'staff-id', full_name: 'Test Staff', branch_id: 'branch-id' }],
                error: null,
            });

            const req = createMockRequest('http://localhost/api/staff/create', {
                method: 'POST',
                body: {
                    full_name: 'Test Staff',
                    branch_id: 'branch-id',
                    is_active: true,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res);

            expect(data).toHaveProperty('id');
            expect(mockSupabase.insert).toHaveBeenCalled();
        });
    });

    describe('Обработка ошибок', () => {
        test('должен обработать ошибку при создании', async () => {
            // Пользователь имеет права
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
            });
            (mockSupabase.from().select().eq as jest.Mock).mockResolvedValue({
                data: [{ roles: { key: 'owner' } }],
                error: null,
            });

            mockServiceClient.auth = {
                admin: {
                    listUsers: jest.fn().mockResolvedValue({
                        data: { users: [] },
                    }),
                },
            };

            mockSupabase.insert.mockResolvedValueOnce({
                data: null,
                error: { message: 'Duplicate entry', code: '23505' },
            });

            const req = createMockRequest('http://localhost/api/staff/create', {
                method: 'POST',
                body: {
                    full_name: 'Test Staff',
                    branch_id: 'branch-id',
                    is_active: true,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });
    });
});

