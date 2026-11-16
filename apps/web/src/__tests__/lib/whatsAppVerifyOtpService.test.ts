import type { ProfileWhatsAppOtpRecord, ProfileWhatsAppOtpStore } from '@/lib/profileWhatsAppOtpStore';
import { verifyExistingWhatsAppOtp } from '@/lib/whatsAppVerifyOtpService';

const NOW = new Date('2026-11-16T10:00:00.000Z');
const hashOtp = (code: string) => `h:${code}`;
const secureEqual = (left: string, right: string) => left === right;

function storeWith(record: ProfileWhatsAppOtpRecord | null) {
    const state = { record };
    const store: jest.Mocked<ProfileWhatsAppOtpStore> = {
        save: jest.fn(async (_userId, next) => {
            state.record = next;
        }),
        load: jest.fn(async () => state.record),
        clear: jest.fn(async () => {
            state.record = null;
        }),
    };
    return { store, state };
}

function profileWriter(error: { message: string } | null = null) {
    const eq = jest.fn().mockResolvedValue({ data: null, error });
    const update = jest.fn(() => ({ eq }));
    return { writer: { from: jest.fn(() => ({ update })) }, update, eq };
}

const validRecord = (overrides: Partial<ProfileWhatsAppOtpRecord> = {}): ProfileWhatsAppOtpRecord => ({
    codeHash: hashOtp('123456'),
    phone: '+996555123456',
    expiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
    attempts: 0,
    ...overrides,
});

function run(store: ProfileWhatsAppOtpStore, code: string, extra: Partial<Parameters<typeof verifyExistingWhatsAppOtp>[0]> = {}) {
    return verifyExistingWhatsAppOtp({
        user: { id: 'user-id', user_metadata: {} },
        code,
        findAuthOwnerByPhone: jest.fn().mockResolvedValue(null),
        otpStore: store,
        hashOtp,
        secureEqual,
        profileWriter: profileWriter().writer,
        now: NOW,
        ...extra,
    });
}

describe('whatsAppVerifyOtpService', () => {
    test('verifies a code stored server-side and writes the identity with the privileged client', async () => {
        const { store, state } = storeWith(validRecord());
        const { writer, update, eq } = profileWriter();

        const result = await run(store, '123456', { profileWriter: writer });

        expect(result).toEqual({ ok: true, data: { message: 'WhatsApp номер подтвержден' } });
        expect(writer.from).toHaveBeenCalledWith('profiles');
        expect(update).toHaveBeenCalledWith({ whatsapp_phone: '+996555123456', whatsapp_verified: true });
        expect(eq).toHaveBeenCalledWith('id', 'user-id');
        expect(state.record).toBeNull();
    });

    test('ignores codes placed in user-editable metadata', async () => {
        const { store } = storeWith(null);
        const { writer } = profileWriter();

        const result = await verifyExistingWhatsAppOtp({
            user: {
                id: 'user-id',
                user_metadata: { whatsapp_otp_code: '123456', whatsapp_otp_phone: '+996555123456' },
            },
            code: '123456',
            findAuthOwnerByPhone: jest.fn().mockResolvedValue(null),
            otpStore: store,
            hashOtp,
            secureEqual,
            profileWriter: writer,
            now: NOW,
        });

        expect(result).toMatchObject({ ok: false, details: { code: 'no_code' } });
        expect(writer.from).not.toHaveBeenCalled();
    });

    test('rejects a wrong code and counts the attempt', async () => {
        const { store, state } = storeWith(validRecord());

        const result = await run(store, '999999');

        expect(result).toEqual({
            ok: false,
            error: 'validation',
            message: 'Неверный код. Попробуйте еще раз.',
            details: { code: 'wrong_code' },
            status: 400,
        });
        expect(state.record?.attempts).toBe(1);
    });

    test('locks the code after too many attempts, even with the right code', async () => {
        const { store, state } = storeWith(validRecord({ attempts: 5 }));
        const { writer } = profileWriter();

        const result = await run(store, '123456', { profileWriter: writer });

        expect(result).toMatchObject({ ok: false, status: 429, details: { code: 'too_many_attempts' } });
        expect(writer.from).not.toHaveBeenCalled();
        expect(state.record).toBeNull();
    });

    test('rejects an expired code', async () => {
        const { store } = storeWith(validRecord({ expiresAt: new Date(NOW.getTime() - 1).toISOString() }));

        const result = await run(store, '123456');

        expect(result).toMatchObject({ ok: false, details: { code: 'expired' } });
        expect(store.clear).toHaveBeenCalledWith('user-id');
    });

    test('rejects a WhatsApp identity owned by another auth user', async () => {
        const { store } = storeWith(validRecord());
        const { writer } = profileWriter();

        const result = await run(store, '123456', {
            profileWriter: writer,
            findAuthOwnerByPhone: jest.fn().mockResolvedValue('existing-whatsapp-user'),
        });

        expect(result).toEqual({
            ok: false,
            error: 'conflict',
            message: 'Этот WhatsApp номер уже используется другим аккаунтом. Войдите через него или обратитесь в поддержку.',
            details: { code: 'whatsapp_identity_already_linked' },
            status: 409,
        });
        expect(writer.from).not.toHaveBeenCalled();
    });

    test('fails closed when the store cannot be read', async () => {
        const { store } = storeWith(null);
        store.load.mockRejectedValueOnce(new Error('down'));

        const result = await run(store, '123456');

        expect(result).toMatchObject({ ok: false, status: 500, details: { code: 'otp_load_failed' } });
    });
});
