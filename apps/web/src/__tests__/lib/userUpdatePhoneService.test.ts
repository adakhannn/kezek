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
        rpc: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        admin.rpc.mockResolvedValue({ data: 1, error: null });
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

    describe('changing a confirmed phone (ARCH-01, API-10)', () => {
        test('the previous number is released first, so the new one starts unconfirmed', async () => {
            supabase.auth.getUser.mockResolvedValue({
                data: { user: { id: 'user-1', phone: '996555123456', phone_confirmed_at: '2026-11-01T00:00:00Z' } },
                error: null,
            });
            admin.auth.admin.updateUserById.mockResolvedValue({ error: null });

            await expect(runUserUpdatePhone({ supabase, admin, phone: '+996700000001' })).resolves.toEqual({ ok: true });

            expect(admin.rpc).toHaveBeenCalledWith('release_auth_phone', { p_user_id: 'user-1', p_phone_digits: '996555123456' });
            expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', { phone: '+996700000001', phone_confirm: false });
            expect(admin.rpc.mock.invocationCallOrder[0]).toBeLessThan(admin.auth.admin.updateUserById.mock.invocationCallOrder[0]);
        });

        test('a failed release stops the change', async () => {
            supabase.auth.getUser.mockResolvedValue({
                data: { user: { id: 'user-1', phone: '996555123456', phone_confirmed_at: '2026-11-01T00:00:00Z' } },
                error: null,
            });
            admin.rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } });

            await expect(runUserUpdatePhone({ supabase, admin, phone: '+996700000001' }))
                .resolves.toEqual({ ok: false, status: 500, error: 'internal', message: 'Не удалось обновить телефон' });
            expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
        });

        test('the same number is a no-op', async () => {
            supabase.auth.getUser.mockResolvedValue({
                data: { user: { id: 'user-1', phone: '996555123456', phone_confirmed_at: '2026-11-01T00:00:00Z' } },
                error: null,
            });

            await expect(runUserUpdatePhone({ supabase, admin, phone: '+996555123456' })).resolves.toEqual({ ok: true });
            expect(admin.rpc).not.toHaveBeenCalled();
            expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
        });

        test('an account without a phone gets one, unconfirmed, without a release', async () => {
            supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', phone: null, phone_confirmed_at: null } }, error: null });
            admin.auth.admin.updateUserById.mockResolvedValue({ error: null });

            await expect(runUserUpdatePhone({ supabase, admin, phone: '+996700000001' })).resolves.toEqual({ ok: true });
            expect(admin.rpc).not.toHaveBeenCalled();
            expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', { phone: '+996700000001', phone_confirm: false });
        });
    });
});
