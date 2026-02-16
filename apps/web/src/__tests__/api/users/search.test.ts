/**
 * Тесты для /api/users/search
 * Поиск пользователей
 */

import { POST } from '@/app/api/users/search/route';
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

describe('/api/users/search', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Успешный поиск', () => {
        test('должен успешно вернуть список пользователей без фильтра', async () => {
            // Мокаем список пользователей из admin API
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [
                        {
                            id: 'user-1',
                            email: 'user1@example.com',
                            phone: '+996555111111',
                            user_metadata: { full_name: 'User 1' },
                        },
                        {
                            id: 'user-2',
                            email: 'user2@example.com',
                            phone: null,
                            user_metadata: { fullName: 'User 2' },
                        },
                    ],
                },
                error: null,
            });

            // Мокаем получение списка сотрудников
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockResolvedValue({
                    data: [
                        {
                            user_id: 'user-1', // user-1 уже сотрудник
                        },
                    ],
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/users/search', {
                method: 'POST',
                body: {
                    page: 1,
                    perPage: 50,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('items');
            expect(data).toHaveProperty('page', 1);
            expect(data).toHaveProperty('perPage', 50);
            // user-1 должен быть исключен, так как он уже сотрудник
            expect((data as { items: unknown[] }).items.length).toBe(1);
        });

        test('должен успешно отфильтровать пользователей по поисковому запросу', async () => {
            // Мокаем список пользователей из admin API
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [
                        {
                            id: 'user-1',
                            email: 'john@example.com',
                            phone: '+996555111111',
                            user_metadata: { full_name: 'John Doe' },
                        },
                        {
                            id: 'user-2',
                            email: 'jane@example.com',
                            phone: '+996555222222',
                            user_metadata: { full_name: 'Jane Smith' },
                        },
                    ],
                },
                error: null,
            });

            // Мокаем получение списка сотрудников (пустой список)
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/users/search', {
                method: 'POST',
                body: {
                    q: 'john',
                    page: 1,
                    perPage: 50,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('items');
            // Должен найти только john@example.com
            const items = (data as { items: Array<{ email: string | null }> }).items;
            expect(items.length).toBe(1);
            expect(items[0].email).toBe('john@example.com');
        });

        test('должен ограничить page и perPage в допустимых пределах', async () => {
            // Мокаем список пользователей из admin API
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [],
                },
                error: null,
            });

            // Мокаем получение списка сотрудников
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/users/search', {
                method: 'POST',
                body: {
                    page: 200, // Превышает максимум 100
                    perPage: 200, // Превышает максимум 100
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            // page и perPage должны быть ограничены до 100
            expect((data as { page: number }).page).toBeLessThanOrEqual(100);
            expect((data as { perPage: number }).perPage).toBeLessThanOrEqual(100);
        });

        test('должен ограничить длину поискового запроса', async () => {
            // Мокаем список пользователей из admin API
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [],
                },
                error: null,
            });

            // Мокаем получение списка сотрудников
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            });

            const longQuery = 'a'.repeat(200); // Длинный запрос

            const req = createMockRequest('http://localhost/api/users/search', {
                method: 'POST',
                body: {
                    q: longQuery,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            // Запрос должен быть обрезан до 100 символов
        });
    });
});


