import { runTelegramLoginRoute } from '@/lib/telegramLoginRouteService';

jest.mock('@/lib/env', () => ({
    getSupabaseUrl: jest.fn(() => 'http://localhost:54321'),
    getSupabaseServiceRoleKey: jest.fn(() => 'service-role-key'),
}));

jest.mock('@/lib/telegram/verify', () => ({
    verifyTelegramAuth: jest.fn(),
    normalizeTelegramData: jest.fn(),
}));

jest.mock('@/lib/telegramLoginService', () => ({
    handleTelegramLogin: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

import { getSupabaseServiceRoleKey } from '@/lib/env';
import { normalizeTelegramData, verifyTelegramAuth } from '@/lib/telegram/verify';
import { handleTelegramLogin } from '@/lib/telegramLoginService';
import { createClient } from '@supabase/supabase-js';

describe('telegramLoginRouteService', () => {
    const admin = { auth: { admin: {} }, from: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        (getSupabaseServiceRoleKey as jest.Mock).mockReturnValue('service-role-key');
        (createClient as jest.Mock).mockReturnValue(admin);
        (verifyTelegramAuth as jest.Mock).mockReturnValue(true);
        (normalizeTelegramData as jest.Mock).mockReturnValue({
            telegram_id: 123456789,
            full_name: 'Test User',
            telegram_username: 'testuser',
            telegram_photo_url: null,
        });
    });

    test('returns validation error for missing required fields', async () => {
        const result = await runTelegramLoginRoute({} as never);

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Недостаточно данных от Telegram',
            details: { code: 'missing_data' },
        });
    });

    test('returns service_unavailable when service role key is missing', async () => {
        (getSupabaseServiceRoleKey as jest.Mock).mockImplementation(() => {
            throw new Error('missing service key');
        });

        const result = await runTelegramLoginRoute({
            id: 123,
            hash: 'hash',
            auth_date: Date.now(),
        });

        expect(result).toEqual({
            ok: false,
            status: 503,
            error: 'service_unavailable',
            message: 'Вход через Telegram временно недоступен. Обратитесь к администратору сайта.',
            details: { code: 'service_key_missing' },
        });
    });

    test('delegates to telegram login service for valid payload', async () => {
        (handleTelegramLogin as jest.Mock).mockResolvedValue({
            ok: true,
            data: {
                userId: 'user-1',
                email: 'telegram_123@telegram.local',
                password: 'secret',
                needsSignIn: true,
                redirect: '/',
                linkage: 'existing',
            },
        });

        const result = await runTelegramLoginRoute({
            id: 123456789,
            hash: 'valid-hash',
            auth_date: Date.now(),
        });

        expect(createClient).toHaveBeenCalledWith('http://localhost:54321', 'service-role-key');
        expect(handleTelegramLogin).toHaveBeenCalled();
        expect(result).toEqual({
            ok: true,
            payload: {
                userId: 'user-1',
                email: 'telegram_123@telegram.local',
                password: 'secret',
                needsSignIn: true,
                redirect: '/',
                linkage: 'existing',
            },
        });
    });
});
