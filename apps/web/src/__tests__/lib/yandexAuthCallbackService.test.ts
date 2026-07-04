import { runYandexOAuthCallback } from '@/lib/yandexAuthCallbackService';
import { createMockSupabase } from '../api/testHelpers';

describe('yandexAuthCallbackService', () => {
    test('builds callback redirect for existing user', async () => {
        const admin = createMockSupabase();
        (admin as unknown as {
            auth: {
                admin: {
                    createUser: jest.Mock;
                    listUsers: jest.Mock;
                    getUserById: jest.Mock;
                    updateUserById: jest.Mock;
                };
                signInWithPassword: jest.Mock;
            };
        }).auth.admin = {
            createUser: jest.fn(),
            listUsers: jest.fn(),
            getUserById: jest.fn().mockResolvedValue({
                data: { user: { email: 'test@yandex.ru' } },
                error: null,
            }),
            updateUserById: jest.fn().mockResolvedValue({
                data: {},
                error: null,
            }),
        };
        (admin as unknown as { auth: { signInWithPassword: jest.Mock } }).auth.signInWithPassword = jest.fn().mockResolvedValue({
            data: { session: { access_token: 'access', refresh_token: 'refresh' } },
            error: null,
        });

        admin.from.mockImplementation((table: string) => {
            if (table === 'profiles') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: 'existing-user-id', yandex_id: '123' },
                        error: null,
                    }),
                    update: jest.fn().mockReturnThis(),
                };
            }
            return admin;
        });

        const result = await runYandexOAuthCallback({
            admin,
            yandexUser: {
                id: '123',
                login: 'testuser',
                default_email: 'test@yandex.ru',
            },
            origin: 'https://kezek.kg',
            redirectTo: '/',
            randomHex: () => 'temp-password',
        });

        expect(result.redirectUrl).toContain('/auth/callback?next=%2F');
        expect(result.redirectUrl).toContain('#access_token=access&refresh_token=refresh');
    });

    test('redirects to sign-in when duplicate email cannot be reconciled', async () => {
        const admin = createMockSupabase();
        (admin as unknown as {
            auth: {
                admin: {
                    createUser: jest.Mock;
                    listUsers: jest.Mock;
                    getUserById: jest.Mock;
                    updateUserById: jest.Mock;
                };
                signInWithPassword: jest.Mock;
            };
        }).auth.admin = {
            createUser: jest.fn().mockResolvedValue({
                data: { user: undefined },
                error: { message: 'email address has already been registered' },
            }),
            listUsers: jest.fn().mockResolvedValue({
                data: { users: [] },
            }),
            getUserById: jest.fn(),
            updateUserById: jest.fn(),
        };
        (admin as unknown as { auth: { signInWithPassword: jest.Mock } }).auth.signInWithPassword = jest.fn();

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

            if (table === 'auth_users_view') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: null,
                    }),
                };
            }

            return admin;
        });

        const result = await runYandexOAuthCallback({
            admin,
            yandexUser: {
                id: '123',
                login: 'testuser',
                default_email: 'test@yandex.ru',
            },
            origin: 'https://kezek.kg',
            redirectTo: '/',
            randomHex: () => 'temp-password',
        });

        expect(result.redirectUrl).toContain('/auth/sign-in?error=');
    });

    test('links Yandex to the authenticated user without creating a second session', async () => {
        const admin = createMockSupabase();
        const updateUserById = jest.fn().mockResolvedValue({ data: {}, error: null });
        (admin as any).auth.admin = {
            createUser: jest.fn(),
            listUsers: jest.fn(),
            getUserById: jest.fn().mockResolvedValue({
                data: { user: { id: 'current-user', user_metadata: { existing: true } } },
                error: null,
            }),
            updateUserById,
        };
        (admin as any).auth.signInWithPassword = jest.fn();

        let profileSelectCount = 0;
        admin.from.mockImplementation(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockImplementation(async () => {
                profileSelectCount += 1;
                return profileSelectCount === 1
                    ? { data: null, error: null }
                    : { data: { id: 'current-user' }, error: null };
            }),
            update: jest.fn().mockReturnThis(),
        }));

        const result = await runYandexOAuthCallback({
            admin: admin as any,
            yandexUser: { id: '123', login: 'linked-user' },
            origin: 'https://kezek.kg',
            redirectTo: '/',
            linkUserId: 'current-user',
        });

        expect(result.redirectUrl).toBe('https://kezek.kg/cabinet/profile?linked=yandex');
        expect(updateUserById).toHaveBeenCalledWith('current-user', expect.objectContaining({
            user_metadata: expect.objectContaining({ yandex_id: '123' }),
        }));
        expect((admin as any).auth.signInWithPassword).not.toHaveBeenCalled();
    });
});
