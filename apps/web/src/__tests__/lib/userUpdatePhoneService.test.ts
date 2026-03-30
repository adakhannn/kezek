import { runUserUpdatePhone } from '@/lib/userUpdatePhoneService';

describe('userUpdatePhoneService', () => {
    const supabase = {
        auth: {
            getUser: jest.fn(),
        },
    };

    const admin = {
        auth: {
            admin: {
                updateUserById: jest.fn(),
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns auth error when user is missing', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const result = await runUserUpdatePhone({
            supabase,
            admin,
            phone: '+996555123456',
        });

        expect(result).toEqual({
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Не авторизован',
        });
    });

    test('returns validation error for invalid phone format', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });

        const result = await runUserUpdatePhone({
            supabase,
            admin,
            phone: '123456',
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Некорректный формат телефона',
        });
    });

    test('updates user phone and clears confirmation flag', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });
        admin.auth.admin.updateUserById.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });

        const result = await runUserUpdatePhone({
            supabase,
            admin,
            phone: '+996555123456',
        });

        expect(result).toEqual({ ok: true });
        expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', {
            phone: '+996555123456',
            phone_confirm: false,
        });
    });
});
