/**
 * Тесты для /api/staff/avatar/remove
 * Удаление аватара сотрудника
 */

import { POST } from '@/app/api/staff/avatar/remove/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { getStaffContext } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/staff/avatar/remove', () => {
    const mockAdmin = createMockSupabase();
    const staffId = 'staff-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getStaffContext as jest.Mock).mockResolvedValue({
            staffId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Успешное удаление', () => {
        test('должен успешно удалить аватар', async () => {
            const avatarUrl = 'https://example.com/avatars/staff-avatars/avatar.jpg';

            // Мокаем получение текущего сотрудника (с аватаром)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        avatar_url: avatarUrl,
                    },
                    error: null,
                }),
            });

            // Мокаем удаление файла из storage
            const mockStorage = {
                remove: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            };

            mockAdmin.storage = {
                from: jest.fn().mockReturnValue(mockStorage),
            };

            // Мокаем обновление записи в БД
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/staff/avatar/remove', {
                method: 'POST',
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(mockStorage.remove).toHaveBeenCalled();
        });

        test('должен вернуть успех если аватар не найден', async () => {
            // Мокаем получение текущего сотрудника (без аватара)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        avatar_url: null,
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/staff/avatar/remove', {
                method: 'POST',
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('message');
        });

        test('должен продолжить даже если удаление файла из storage не удалось', async () => {
            const avatarUrl = 'https://example.com/avatars/staff-avatars/avatar.jpg';

            // Мокаем получение текущего сотрудника (с аватаром)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        avatar_url: avatarUrl,
                    },
                    error: null,
                }),
            });

            // Мокаем ошибку при удалении файла из storage
            const mockStorage = {
                remove: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'File not found' },
                }),
            };

            mockAdmin.storage = {
                from: jest.fn().mockReturnValue(mockStorage),
            };

            // Мокаем обновление записи в БД (должно выполниться даже при ошибке storage)
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/staff/avatar/remove', {
                method: 'POST',
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});


