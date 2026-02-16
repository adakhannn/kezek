/**
 * Тесты для /api/staff/avatar/upload
 * Загрузка аватара сотрудника
 */

import { POST } from '@/app/api/staff/avatar/upload/route';
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

describe('/api/staff/avatar/upload', () => {
    const mockAdmin = createMockSupabase();
    const staffId = 'staff-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getStaffContext as jest.Mock).mockResolvedValue({
            staffId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 если файл не предоставлен', async () => {
            const formData = new FormData();

            const req = createMockRequest('http://localhost/api/staff/avatar/upload', {
                method: 'POST',
                body: formData,
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 если файл не является изображением', async () => {
            const formData = new FormData();
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            formData.append('file', file);

            const req = createMockRequest('http://localhost/api/staff/avatar/upload', {
                method: 'POST',
                body: formData,
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 если размер файла превышает 5MB', async () => {
            const formData = new FormData();
            // Создаем файл размером больше 5MB
            const largeContent = new Array(6 * 1024 * 1024).fill('a').join('');
            const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
            formData.append('file', file);

            const req = createMockRequest('http://localhost/api/staff/avatar/upload', {
                method: 'POST',
                body: formData,
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешная загрузка', () => {
        test('должен успешно загрузить аватар', async () => {
            const formData = new FormData();
            const file = new File(['image content'], 'avatar.jpg', { type: 'image/jpeg' });
            formData.append('file', file);

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

            // Мокаем загрузку файла в storage
            mockAdmin.storage = {
                from: jest.fn().mockReturnValue({
                    upload: jest.fn().mockResolvedValue({
                        data: {
                            path: 'staff-avatars/staff-uuid-1234567890.jpg',
                        },
                        error: null,
                    }),
                    getPublicUrl: jest.fn().mockReturnValue({
                        data: {
                            publicUrl: 'https://example.com/avatars/staff-avatars/staff-uuid-1234567890.jpg',
                        },
                    }),
                    remove: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                }),
            };

            // Мокаем обновление записи в БД
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/staff/avatar/upload', {
                method: 'POST',
                body: formData,
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('url');
        });

        test('должен удалить старый аватар перед загрузкой нового', async () => {
            const formData = new FormData();
            const file = new File(['image content'], 'avatar.jpg', { type: 'image/jpeg' });
            formData.append('file', file);

            const oldAvatarUrl = 'https://example.com/avatars/staff-avatars/old-avatar.jpg';

            // Мокаем получение текущего сотрудника (с аватаром)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        avatar_url: oldAvatarUrl,
                    },
                    error: null,
                }),
            });

            // Мокаем удаление старого файла
            const mockStorage = {
                upload: jest.fn().mockResolvedValue({
                    data: {
                        path: 'staff-avatars/staff-uuid-1234567890.jpg',
                    },
                    error: null,
                }),
                getPublicUrl: jest.fn().mockReturnValue({
                    data: {
                        publicUrl: 'https://example.com/avatars/staff-avatars/staff-uuid-1234567890.jpg',
                    },
                }),
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

            const req = createMockRequest('http://localhost/api/staff/avatar/upload', {
                method: 'POST',
                body: formData,
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            // Проверяем, что был вызван remove для старого файла
            expect(mockStorage.remove).toHaveBeenCalled();
        });
    });
});


