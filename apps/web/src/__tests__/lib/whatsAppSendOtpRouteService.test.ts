import { runWhatsAppSendOtpRoute } from '@/lib/whatsAppSendOtpRouteService';

const mockHasSecret = jest.fn(() => true);
jest.mock('@/lib/env', () => ({
    getWhatsAppAuthTemplateName: () => 'test_auth_template',
    getWhatsAppAuthTemplateLanguage: () => 'ru',
    hasUsableWhatsAppOtpHashSecret: () => mockHasSecret(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/senders/sms', () => ({
    normalizePhoneToE164: jest.fn(),
}));

jest.mock('@/lib/senders/whatsapp', () => ({
    sendWhatsApp: jest.fn(),
}));

jest.mock('@/lib/whatsAppSendOtpService', () => ({
    sendProfileWhatsAppOtp: jest.fn(),
}));

import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { hashWhatsappOtp } from '@/lib/whatsAppOtpHash';
import { sendProfileWhatsAppOtp } from '@/lib/whatsAppSendOtpService';

describe('whatsAppSendOtpRouteService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockHasSecret.mockReturnValue(true);
    });

    test('fails closed without a usable OTP hash secret', async () => {
        mockHasSecret.mockReturnValue(false);

        const result = await runWhatsAppSendOtpRoute({ supabase: {} as never, phone: '+996555123456' });

        expect(result).toMatchObject({ ok: false, status: 503, details: { code: 'otp_secret_not_configured' } });
        expect(sendProfileWhatsAppOtp).not.toHaveBeenCalled();
    });

    test('delegates profile OTP flow with route dependencies', async () => {
        const supabase = { auth: { getUser: jest.fn() }, from: jest.fn() };
        const otpStore = { save: jest.fn(), load: jest.fn(), clear: jest.fn() };
        (sendProfileWhatsAppOtp as jest.Mock).mockResolvedValue({
            ok: true,
            data: { message: 'Код отправлен на WhatsApp' },
        });

        const result = await runWhatsAppSendOtpRoute({
            supabase: supabase as never,
            phone: '+996555123456',
            otpStore,
        });

        expect(sendProfileWhatsAppOtp).toHaveBeenCalledWith({
            supabase,
            phone: '+996555123456',
            normalizePhone: normalizePhoneToE164,
            sendMessage: sendWhatsApp,
            authTemplateName: 'test_auth_template',
            authTemplateLanguage: 'ru',
            requireTemplate: true,
            otpStore,
            hashOtp: hashWhatsappOtp,
        });
        expect(result).toEqual({
            ok: true,
            data: { message: 'Код отправлен на WhatsApp' },
        });
    });
});
