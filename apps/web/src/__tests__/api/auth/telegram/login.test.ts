/**
 * Тесты для /api/auth/telegram/login
 * Авторизация через Telegram
 */

import { POST } from '@/app/api/auth/telegram/login/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { verifyTelegramAuth, normalizeTelegramData } from '@/lib/telegram/verify';

// Мокаем зависимости
jest.mock('@/lib/telegram/verify', () => ({
    verifyTelegramAuth: jest.fn(),
    normalizeTelegramData: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

describe('/api/auth/telegram/login', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии обязательных полей', async () => {
            const req = createMockRequest('http://localhost/api/auth/telegram/login', {
                method: 'POST',
                body: {},
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при неверной подписи Telegram', async () => {
            (verifyTelegramAuth as jest.Mock).mockReturnValue(false);

            const req = createMockRequest('http://localhost/api/auth/telegram/login', {
                method: 'POST',
                body: {
                    id: 123456789,
                    hash: 'invalid-hash',
                    auth_date: Date.now(),
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешная авторизация', () => {
        test('должен успешно авторизовать существующего пользователя', async () => {
            (verifyTelegramAuth as jest.Mock).mockReturnValue(true);
            (normalizeTelegramData as jest.Mock).mockReturnValue({
                telegram_id: 123456789,
                full_name: 'Test User',
                telegram_username: 'testuser',
                telegram_photo_url: null,
            });

            const mockAdmin = createMockSupabase();

            // Мокаем createClient
            const { createClient } = require('@supabase/supabase-js');
            createClient.mockReturnValue(mockAdmin);

            // Мокаем поиск существующего профиля
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'user-id',
                        telegram_id: 123456789,
                    },
                    error: null,
                }),
            });

            // Мокаем обновление профиля
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/auth/telegram/login', {
                method: 'POST',
                body: {
                    id: 123456789,
                    hash: 'valid-hash',
                    auth_date: Date.now(),
                },
            });

            const res = await POST(req);
            // Может вернуть 200 или 201 в зависимости от того, новый пользователь или существующий
            expect([200, 201]).toContain(res.status);
        });
    });
});


