import { unlinkSocialIdentity } from '@/lib/socialIdentityUnlinkService';

function createAdmin(options?: {
    identities?: Array<{ provider: string }>;
    profile?: Record<string, unknown>;
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
                    data: { user: { id: 'user-id', identities: options?.identities ?? [], user_metadata: {} } },
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
    test('rejects unlinking the last login method', async () => {
        const { admin } = createAdmin({ identities: [{ provider: 'google' }] });
        const result = await unlinkSocialIdentity({ admin: admin as never, userId: 'user-id', provider: 'google' });

        expect(result).toMatchObject({ ok: false, status: 409, details: { code: 'last_login_method' } });
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
});
