import { POST } from '@/app/api/auth/telegram/link/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../../testHelpers';

setupApiTestMocks();

import { createSupabaseClients } from '@/lib/supabaseHelpers';
import { normalizeTelegramData, verifyTelegramAuth } from '@/lib/telegram/verify';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseClients: jest.fn(),
}));

jest.mock('@/lib/telegram/verify', () => ({
    verifyTelegramAuth: jest.fn(),
    normalizeTelegramData: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    routeRateLimit: jest.requireActual('@/lib/rateLimit').routeRateLimit,
    withRateLimit: jest.fn((req, _config, handler) => handler()),
    RateLimitConfigs: {
        auth: {},
    },
}));

describe('/api/auth/telegram/link', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const userId = '11111111-1111-4111-8111-111111111111';
    const telegramId = 123456789;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAdmin.auth.admin = {
            listUsers: jest.fn(),
            updateUserById: jest.fn(),
            createUser: jest.fn(),
            generateLink: jest.fn(),
            getUserById: jest.fn(),
        };
        (createSupabaseClients as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            admin: mockAdmin,
        });
        (verifyTelegramAuth as jest.Mock).mockReturnValue(true);
        (normalizeTelegramData as jest.Mock).mockReturnValue({
            telegram_id: telegramId,
            full_name: 'Test User',
            telegram_username: 'testuser',
            telegram_photo_url: null,
        });
    });

    test('returns 401 for unauthenticated user', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/auth/telegram/link', {
            method: 'POST',
            body: { id: telegramId, hash: 'valid-hash', auth_date: Date.now() },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 401, 'auth');
    });

    test('returns 400 when required fields are missing', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: userId, user_metadata: {} } },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/auth/telegram/link', {
            method: 'POST',
            body: {},
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'validation');
    });

    test('returns 400 for invalid Telegram signature', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: userId, user_metadata: {} } },
            error: null,
        });
        (verifyTelegramAuth as jest.Mock).mockReturnValue(false);

        const req = createMockRequest('http://localhost/api/auth/telegram/link', {
            method: 'POST',
            body: { id: telegramId, hash: 'invalid-hash', auth_date: Date.now() },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'validation');
    });

    test('links Telegram account to current user', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: userId, user_metadata: { locale: 'ru' } } },
            error: null,
        });

        let profilesCall = 0;
        mockAdmin.from.mockImplementation((table: string) => {
            if (table === 'profiles' && profilesCall === 0) {
                profilesCall += 1;
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                };
            }

            if (table === 'profiles') {
                return {
                    update: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                };
            }

            return mockAdmin;
        });
        mockAdmin.auth.admin.updateUserById.mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/auth/telegram/link', {
            method: 'POST',
            body: { id: telegramId, hash: 'valid-hash', auth_date: Date.now() },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.message).toContain('Telegram');
        expect(mockAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
            userId,
            expect.objectContaining({
                user_metadata: expect.objectContaining({
                    telegram_id: telegramId,
                    telegram_username: 'testuser',
                }),
            }),
        );
    });

    test('returns 400 when Telegram account is linked to another user', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: userId, user_metadata: {} } },
            error: null,
        });

        mockAdmin.from.mockImplementation((table: string) => {
            if (table === 'profiles') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: 'other-user-id', telegram_id: telegramId },
                        error: null,
                    }),
                };
            }

            return mockAdmin;
        });

        const req = createMockRequest('http://localhost/api/auth/telegram/link', {
            method: 'POST',
            body: { id: telegramId, hash: 'valid-hash', auth_date: Date.now() },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'conflict');
    });
});
