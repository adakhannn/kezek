import { unlinkSocialIdentity } from '@/lib/socialIdentityUnlinkService';

function createAdmin(options?: {
    identities?: Array<{ provider: string }>;
    profile?: Record<string, unknown>;
    userMetadata?: Record<string, unknown>;
    authPhone?: { phone: string; phone_confirmed_at: string | null };
}) {
    const profile = {
        yandex_id: null,
        telegram_id: null,
        telegram_verified: false,
        whatsapp_phone: null,
        whatsapp_verified: false,
        ...options?.profile,
    };
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq: updateEq });
    const maybeSingle = jest.fn().mockResolvedValue({ data: profile, error: null });
    const select = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ maybeSingle }) });
    const admin = {
        auth: {
            admin: {
                getUserById: jest.fn().mockResolvedValue({
                    data: { user: { id: 'user-id', identities: options?.identities ?? [], user_metadata: options?.userMetadata ?? {}, ...options?.authPhone } },
                    error: null,
                }),
                updateUserById: jest.fn().mockResolvedValue({ error: null }),
            },
        },
        from: jest.fn().mockReturnValue({ select, update }),
        rpc: jest.fn().mockResolvedValue({ data: 1, error: null }),
    };
    return { admin, update, updateEq };
}

describe('unlinkSocialIdentity', () => {
    test('unlinks Telegram while preserving the Yandex login', async () => {
        const { admin, update } = createAdmin({
            profile: { yandex_id: 'yandex-id', telegram_id: 123, telegram_verified: true },
            userMetadata: { yandex_id: 'yandex-id', telegram_id: 123, telegram_username: 'test' },
        });
        const result = await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'telegram' });
        expect(result).toEqual({ ok: true, data: { provider: 'telegram', remainingMethods: 1 } });
        expect(update).toHaveBeenCalledWith({ telegram_id: null, telegram_verified: false, notify_telegram: false });
        expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-id', {
            user_metadata: { yandex_id: 'yandex-id', telegram_id: null, telegram_username: null },
        });
    });
    test('rejects unlinking the last login method', async () => {
        const { admin } = createAdmin({ identities: [{ provider: 'google' }] });
        const result = await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'google' });

        expect(result).toMatchObject({ ok: false, status: 409, details: { code: 'last_login_method' } });
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    test('Sign in with Apple counts as a login method: Google can be unlinked beside it', async () => {
        const { admin } = createAdmin({ identities: [{ provider: 'apple' }, { provider: 'google' }] });
        const result = await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'google' });

        expect(result).toEqual({ ok: true, data: { provider: 'google', remainingMethods: 1 } });
        expect(admin.rpc).toHaveBeenCalledWith('unlink_auth_identity', { target_user_id: 'user-id', target_provider: 'google' });
    });

    test('an Apple-only account has nothing else to unlink, and Apple is never unlinked here', async () => {
        const { admin } = createAdmin({ identities: [{ provider: 'apple' }] });
        const result = await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'google' });

        expect(result).toMatchObject({ ok: false, status: 404, details: { code: 'identity_not_connected' } });
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    test('unlinks Google when another method remains', async () => {
        const { admin } = createAdmin({
            identities: [{ provider: 'google' }],
            profile: { yandex_id: 'yandex-id' },
        });
        const result = await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'google' });

        expect(result).toEqual({ ok: true, data: { provider: 'google', remainingMethods: 1 } });
        expect(admin.rpc).toHaveBeenCalledWith('unlink_auth_identity', {
            target_user_id: 'user-id',
            target_provider: 'google',
        });
    });

    test('unlinks WhatsApp and disables its notifications', async () => {
        const { admin, update } = createAdmin({
            identities: [{ provider: 'google' }],
            profile: { whatsapp_phone: '+996555123456', whatsapp_verified: true },
        });
        const result = await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'whatsapp' });

        expect(result).toEqual({ ok: true, data: { provider: 'whatsapp', remainingMethods: 1 } });
        expect(update).toHaveBeenCalledWith({ whatsapp_phone: null, whatsapp_verified: false, notify_whatsapp: false });
    });

    test('unlinks a legacy Yandex connection stored only in auth metadata', async () => {
        const { admin, update } = createAdmin({
            identities: [{ provider: 'google' }],
            userMetadata: { yandex_id: 'legacy-yandex-id', yandex_username: 'legacy', auth_provider: 'yandex' },
        });

        const result = await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'yandex' });

        expect(result).toEqual({ ok: true, data: { provider: 'yandex', remainingMethods: 1 } });
        expect(update).toHaveBeenCalledWith({ yandex_id: null });
        expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-id', {
            user_metadata: {
                yandex_id: null,
                yandex_username: null,
                yandex_email: null,
                auth_provider: null,
            },
        });
    });

    describe('WhatsApp (API-10)', () => {
        test('the linked number and a confirmed Auth phone leave the Auth record before the profile link', async () => {
            const { admin, update } = createAdmin({
                identities: [{ provider: 'google' }, { provider: 'phone' }],
                profile: { whatsapp_phone: '+996555123456', whatsapp_verified: true },
                userMetadata: { phone: '+996555123456', full_name: 'Айгерим' },
                authPhone: { phone: '996700000001', phone_confirmed_at: '2026-11-01T00:00:00Z' },
            });

            const result = await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'whatsapp' });

            expect(result).toEqual({ ok: true, data: { provider: 'whatsapp', remainingMethods: 1 } });
            expect(admin.rpc).toHaveBeenCalledWith('release_auth_phone', { p_user_id: 'user-id', p_phone_digits: '996555123456' });
            expect(admin.rpc).toHaveBeenCalledWith('release_auth_phone', { p_user_id: 'user-id', p_phone_digits: '996700000001' });
            expect(admin.rpc.mock.invocationCallOrder[1]).toBeLessThan(update.mock.invocationCallOrder[0]);
            // the metadata write-back must not restore the released copy
            expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-id', {
                user_metadata: expect.objectContaining({ phone: null, full_name: 'Айгерим', whatsapp_verified: null }),
            });
        });

        test('a failed release keeps the link and reports it', async () => {
            const { admin, update } = createAdmin({
                identities: [{ provider: 'google' }],
                profile: { whatsapp_phone: '+996555123456', whatsapp_verified: true },
            });
            admin.rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } });

            const result = await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'whatsapp' });

            expect(result).toMatchObject({ ok: false, status: 500, details: { code: 'auth_phone_release_failed' } });
            expect(update).not.toHaveBeenCalled();
        });

        test('other providers release no phone', async () => {
            const { admin } = createAdmin({
                profile: { yandex_id: 'yandex-id', telegram_id: 123, telegram_verified: true },
                authPhone: { phone: '996700000001', phone_confirmed_at: '2026-11-01T00:00:00Z' },
            });

            await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'telegram' });

            expect(admin.rpc).not.toHaveBeenCalledWith('release_auth_phone', expect.anything());
        });
    });
});
