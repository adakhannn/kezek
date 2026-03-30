import { getWhatsAppTestSnapshot } from '@/lib/whatsAppTestService';

describe('whatsAppTestService', () => {
    test('marks setup as configured when all required values are present', () => {
        const result = getWhatsAppTestSnapshot({
            WHATSAPP_ACCESS_TOKEN: 'test-token-1234567890',
            WHATSAPP_PHONE_NUMBER_ID: '123456789',
            WHATSAPP_VERIFY_TOKEN: 'verify-token',
        });

        expect(result.configured).toBe(true);
        expect(result.details.WHATSAPP_PHONE_NUMBER_ID_VALID).toBe(true);
    });

    test('marks setup as invalid when phone number id is not numeric', () => {
        const result = getWhatsAppTestSnapshot({
            WHATSAPP_ACCESS_TOKEN: 'token',
            WHATSAPP_PHONE_NUMBER_ID: 'invalid-id',
            WHATSAPP_VERIFY_TOKEN: 'verify-token',
        });

        expect(result.configured).toBe(false);
        expect(result.details.WHATSAPP_PHONE_NUMBER_ID_VALID).toBe(false);
    });
});
