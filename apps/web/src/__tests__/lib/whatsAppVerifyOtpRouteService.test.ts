import { runWhatsAppVerifyOtpRoute } from '@/lib/whatsAppVerifyOtpRouteService';

jest.mock('@/lib/whatsAppVerifyOtpService', () => ({
    verifyExistingWhatsAppOtp: jest.fn(),
}));

import { hashWhatsappOtp, secureEqualHex } from '@/lib/whatsAppOtpHash';
import { verifyExistingWhatsAppOtp } from '@/lib/whatsAppVerifyOtpService';

describe('whatsAppVerifyOtpRouteService', () => {
    const originalEnv = process.env;
    const admin = { from: jest.fn(), auth: { admin: {} } };
    const otpStore = { save: jest.fn(), load: jest.fn(), clear: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('returns auth error when user is missing', async () => {
        const supabase = {
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user: null },
                }),
            },
        };

        const result = await runWhatsAppVerifyOtpRoute({
            supabase: supabase as never,
            admin: admin as never,
            code: '123456',
            findAuthOwnerByPhone: jest.fn(),
        });

        expect(result).toEqual({
            ok: false,
            error: 'auth',
            message: 'Не авторизован',
            status: 401,
        });
    });

    test('fails closed in production without a configured OTP hash secret', async () => {
        Object.assign(process.env, { NODE_ENV: 'production' });
        delete process.env.WHATSAPP_OTP_HASH_SECRET;
        const supabase = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } };

        const result = await runWhatsAppVerifyOtpRoute({
            supabase: supabase as never,
            admin: admin as never,
            code: '123456',
            findAuthOwnerByPhone: jest.fn(),
            otpStore,
        });

        expect(result).toMatchObject({ ok: false, status: 503, details: { code: 'otp_secret_not_configured' } });
        expect(verifyExistingWhatsAppOtp).not.toHaveBeenCalled();
    });

    test('delegates verification with server-side store and privileged writer', async () => {
        const user = { id: 'user-1', user_metadata: {} };
        const supabase = {
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user },
                }),
            },
        };
        const findAuthOwnerByPhone = jest.fn();
        (verifyExistingWhatsAppOtp as jest.Mock).mockResolvedValue({
            ok: true,
            data: { message: 'WhatsApp номер подтвержден' },
        });

        const result = await runWhatsAppVerifyOtpRoute({
            supabase: supabase as never,
            admin: admin as never,
            code: '123456',
            findAuthOwnerByPhone,
            otpStore,
        });

        expect(verifyExistingWhatsAppOtp).toHaveBeenCalledWith({
            user,
            code: '123456',
            findAuthOwnerByPhone,
            otpStore,
            hashOtp: hashWhatsappOtp,
            secureEqual: secureEqualHex,
            profileWriter: admin,
        });
        expect(result).toEqual({
            ok: true,
            data: { message: 'WhatsApp номер подтвержден' },
        });
    });
});
