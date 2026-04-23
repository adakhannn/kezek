import { sanitizeObject } from '@shared-client/log';

describe('log sanitization', () => {
    test('masks telegram/mobile auth sensitive fields', () => {
        const sanitized = sanitizeObject({
            nonce: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
            exchangeCode: 'ABC12345XYZ',
            otp: '123456',
            signature: 'a'.repeat(64),
            requestId: 'request-1234567890',
            nested: {
                oneTimeCode: '654321',
            },
        }) as Record<string, unknown>;

        expect(String(sanitized.nonce)).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
        expect(String(sanitized.exchangeCode)).not.toContain('ABC12345XYZ');
        expect(String(sanitized.otp)).toBe('****');
        expect(String(sanitized.signature)).toContain('*');
        expect(String(sanitized.requestId)).toContain('*');

        const nested = sanitized.nested as Record<string, unknown>;
        expect(String(nested.oneTimeCode)).toBe('****');
    });
});
