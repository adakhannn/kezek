import { CONFIRMED_PHONE_CHANGE_MESSAGE, runUserUpdatePhone } from '@/lib/userUpdatePhoneService';

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

    describe('a confirmed phone (ARCH-01)', () => {
        test('is not replaced by another number without a code', async () => {
            supabase.auth.getUser.mockResolvedValue({
                data: { user: { id: 'user-1', phone: '996555123456', phone_confirmed_at: '2026-11-01T00:00:00Z' } },
                error: null,
            });

            const result = await runUserUpdatePhone({ supabase, admin, phone: '+996700000001' });

            expect(result).toEqual({ ok: false, status: 409, error: 'conflict', message: CONFIRMED_PHONE_CHANGE_MESSAGE });
            expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
        });

        test('the same number is a no-op', async () => {
            supabase.auth.getUser.mockResolvedValue({
                data: { user: { id: 'user-1', phone: '996555123456', phone_confirmed_at: '2026-11-01T00:00:00Z' } },
                error: null,
            });

            await expect(runUserUpdatePhone({ supabase, admin, phone: '+996555123456' })).resolves.toEqual({ ok: true });
            expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
        });

        test('an account without a confirmed phone still gets one, unconfirmed', async () => {
            supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', phone: null, phone_confirmed_at: null } }, error: null });
            admin.auth.admin.updateUserById.mockResolvedValue({ error: null });

            await expect(runUserUpdatePhone({ supabase, admin, phone: '+996700000001' })).resolves.toEqual({ ok: true });
            expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', { phone: '+996700000001', phone_confirm: false });
        });
    });
});
