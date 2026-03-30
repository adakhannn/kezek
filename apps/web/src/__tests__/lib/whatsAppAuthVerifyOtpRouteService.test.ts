import { runWhatsAppAuthVerifyOtpRoute } from '@/lib/whatsAppAuthVerifyOtpRouteService';

jest.mock('@/lib/senders/sms', () => ({
    normalizePhoneToE164: jest.fn(),
}));

jest.mock('@/lib/whatsAppAuthVerifyOtpService', () => ({
    verifyWhatsAppOtpLogin: jest.fn(),
}));

import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { verifyWhatsAppOtpLogin } from '@/lib/whatsAppAuthVerifyOtpService';

describe('whatsAppAuthVerifyOtpRouteService', () => {
    const admin = { auth: { admin: {} }, from: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns validation error for invalid phone format', async () => {
        (normalizePhoneToE164 as jest.Mock).mockReturnValue(null);

        const result = await runWhatsAppAuthVerifyOtpRoute({
            admin: admin as never,
            phone: 'invalid-phone',
            code: '123456',
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Неверный формат номера телефона',
            details: { code: 'invalid_phone' },
        });
    });

    test('delegates valid normalized phone to verify service', async () => {
        (normalizePhoneToE164 as jest.Mock).mockReturnValue('+996555123456');
        (verifyWhatsAppOtpLogin as jest.Mock).mockResolvedValue({
            ok: true,
            data: {
                message: 'Вход выполнен успешно',
                userId: 'user-1',
                phone: '+996555123456',
                isNewUser: false,
            },
        });

        const result = await runWhatsAppAuthVerifyOtpRoute({
            admin: admin as never,
            phone: '+996555123456',
            code: '123456',
        });

        expect(verifyWhatsAppOtpLogin).toHaveBeenCalledWith({
            admin,
            phoneE164: '+996555123456',
            code: '123456',
        });
        expect(result).toEqual({
            ok: true,
            payload: {
                message: 'Вход выполнен успешно',
                userId: 'user-1',
                phone: '+996555123456',
                isNewUser: false,
            },
        });
    });
});
