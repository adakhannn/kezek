import { runWhatsAppSendOtpRoute } from '@/lib/whatsAppSendOtpRouteService';

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
import { sendProfileWhatsAppOtp } from '@/lib/whatsAppSendOtpService';

describe('whatsAppSendOtpRouteService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates profile OTP flow with route dependencies', async () => {
        const supabase = { auth: { getUser: jest.fn(), updateUser: jest.fn() }, from: jest.fn() };
        (sendProfileWhatsAppOtp as jest.Mock).mockResolvedValue({
            ok: true,
            data: { message: 'Код отправлен на WhatsApp' },
        });

        const result = await runWhatsAppSendOtpRoute({
            supabase: supabase as never,
            phone: '+996555123456',
        });

        expect(sendProfileWhatsAppOtp).toHaveBeenCalledWith({
            supabase,
            phone: '+996555123456',
            normalizePhone: normalizePhoneToE164,
            sendMessage: sendWhatsApp,
        });
        expect(result).toEqual({
            ok: true,
            data: { message: 'Код отправлен на WhatsApp' },
        });
    });
});
