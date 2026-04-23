import {
    formatTelegramMobileStartPayload,
    parseTelegramMobileStartPayload,
} from '@/lib/telegramMobileDeepLinkPayload';

describe('telegramMobileDeepLinkPayload', () => {
    test('formats payload as km1_<nonce>', () => {
        const nonce = 'abcDEF_123-XYZ_nonce_payload';
        const payload = formatTelegramMobileStartPayload(nonce);
        expect(payload).toBe(`km1_${nonce}`);
    });

    test('parses payload and extracts nonce', () => {
        const parsed = parseTelegramMobileStartPayload('km1_abcDEF_123-XYZ_nonce_payload');
        expect(parsed).toEqual({
            nonce: 'abcDEF_123-XYZ_nonce_payload',
            version: 'km1',
        });
    });

    test('returns null for unsupported payload format', () => {
        expect(parseTelegramMobileStartPayload('login_nonce')).toBeNull();
        expect(parseTelegramMobileStartPayload('km2_nonce')).toBeNull();
    });

    test('rejects invalid nonce format during formatting', () => {
        expect(() => formatTelegramMobileStartPayload('short_nonce')).toThrow(
            'Invalid nonce format for Telegram deep-link payload',
        );
        expect(() => formatTelegramMobileStartPayload('invalid nonce with spaces')).toThrow(
            'Invalid nonce format for Telegram deep-link payload',
        );
    });

    test('returns null for invalid nonce payload values', () => {
        expect(parseTelegramMobileStartPayload('km1_short_nonce')).toBeNull();
        expect(
            parseTelegramMobileStartPayload('km1_nonce-with-$-invalid-chars-1234567890'),
        ).toBeNull();
    });
});
