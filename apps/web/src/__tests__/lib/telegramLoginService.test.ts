import { handleTelegramLogin } from '@/lib/telegramLoginService';
import { createMockSupabase } from '../api/testHelpers';

describe('telegramLoginService', () => {
    test('returns sign-in payload for an existing Telegram profile', async () => {
        const admin = createMockSupabase();
        (admin as unknown as {
            auth: {
                admin: {
                    getUserById: jest.Mock;
                    updateUserById: jest.Mock;
                    createUser: jest.Mock;
                };
            };
        }).auth.admin = {
            getUserById: jest.fn(),
            updateUserById: jest.fn(),
            createUser: jest.fn(),
        };

        admin.from.mockImplementation((table: string) => {
            if (table === 'profiles') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: 'existing-user-id', telegram_id: 123456789 },
                        error: null,
                    }),
                    update: jest.fn().mockReturnThis(),
                };
            }

            return admin;
        });

        admin.auth.admin.getUserById.mockResolvedValue({
            data: { user: { email: 'telegram_123456789@telegram.local' } },
            error: null,
        });
        admin.auth.admin.updateUserById.mockResolvedValue({
            data: { user: { id: 'existing-user-id' } },
            error: null,
        });

        const result = await handleTelegramLogin({
            admin,
            normalized: {
                telegram_id: 123456789,
                full_name: 'Test User',
                telegram_username: 'testuser',
                telegram_photo_url: null,
            },
            randomHex: (size) => `hex-${size}`,
        });

        expect(result).toEqual({
            ok: true,
            data: {
                userId: 'existing-user-id',
                email: 'telegram_123456789@telegram.local',
                password: 'hex-16',
                needsSignIn: true,
                redirect: '/',
            },
        });
    });

    test('returns internal error when auth user creation fails', async () => {
        const admin = createMockSupabase();
        (admin as unknown as {
            auth: {
                admin: {
                    getUserById: jest.Mock;
                    updateUserById: jest.Mock;
                    createUser: jest.Mock;
                };
            };
        }).auth.admin = {
            getUserById: jest.fn(),
            updateUserById: jest.fn(),
            createUser: jest.fn(),
        };

        admin.from.mockImplementation((table: string) => {
            if (table === 'profiles') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                };
            }

            return admin;
        });

        admin.auth.admin.createUser.mockResolvedValue({
            data: { user: undefined },
            error: { message: 'create failed' },
        });

        const result = await handleTelegramLogin({
            admin,
            normalized: {
                telegram_id: 123456789,
                full_name: 'Test User',
                telegram_username: 'testuser',
                telegram_photo_url: null,
            },
            randomHex: (size) => `hex-${size}`,
        });

        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'create failed',
            details: { code: 'auth_error' },
            status: 500,
        });
    });
});
