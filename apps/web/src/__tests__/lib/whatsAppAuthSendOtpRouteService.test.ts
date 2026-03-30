import { runWhatsAppAuthSendOtpRoute } from '@/lib/whatsAppAuthSendOtpRouteService';

jest.mock('@/lib/senders/sms', () => ({
    normalizePhoneToE164: jest.fn(),
}));

jest.mock('@/lib/senders/whatsapp', () => ({
    sendWhatsApp: jest.fn(),
}));

jest.mock('@/lib/whatsAppAuthSendOtpService', () => ({
    sendWhatsAppAuthOtp: jest.fn(),
}));

import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { sendWhatsAppAuthOtp } from '@/lib/whatsAppAuthSendOtpService';

describe('whatsAppAuthSendOtpRouteService', () => {
    const admin = { auth: { admin: {} }, from: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates dependencies to sendWhatsAppAuthOtp', async () => {
        (sendWhatsAppAuthOtp as jest.Mock).mockResolvedValue({
            ok: true,
            data: { message: 'Код отправлен на WhatsApp' },
        });

        const result = await runWhatsAppAuthSendOtpRoute({
            admin: admin as never,
            phone: '+996555123456',
        });

        expect(sendWhatsAppAuthOtp).toHaveBeenCalledWith({
            admin,
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
