import { hasUsableWhatsAppOtpHashSecret } from '@/lib/env';
import { hashWhatsappOtp, hashWhatsappPhone, secureEqualHex } from '@/lib/whatsAppOtpHash';

const originalEnv = { NODE_ENV: process.env.NODE_ENV, WHATSAPP_OTP_HASH_SECRET: process.env.WHATSAPP_OTP_HASH_SECRET };

afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

describe('whatsAppOtpHash', () => {
    test('creates deterministic otp hash and validates with secure compare', () => {
        const hashA = hashWhatsappOtp('123456');
        const hashB = hashWhatsappOtp('123456');
        const hashC = hashWhatsappOtp('654321');

        expect(hashA).toBe(hashB);
        expect(hashA).not.toBe(hashC);
        expect(secureEqualHex(hashA, hashB)).toBe(true);
        expect(secureEqualHex(hashA, hashC)).toBe(false);
    });

    test('creates deterministic phone hash and differs from otp namespace', () => {
        const phoneHash = hashWhatsappPhone('+996500574029');
        const phoneHash2 = hashWhatsappPhone('+996500574029');
        const otpHash = hashWhatsappOtp('500574');

        expect(phoneHash).toBe(phoneHash2);
        expect(phoneHash).not.toBe(otpHash);
    });

    test('production never hashes with the public development key', () => {
        Object.assign(process.env, { NODE_ENV: 'production' });
        delete process.env.WHATSAPP_OTP_HASH_SECRET;
        expect(hasUsableWhatsAppOtpHashSecret()).toBe(false);
        expect(() => hashWhatsappOtp('123456')).toThrow('WHATSAPP_OTP_HASH_SECRET is not configured');
        expect(() => hashWhatsappPhone('+996500574029')).toThrow('WHATSAPP_OTP_HASH_SECRET is not configured');

        process.env.WHATSAPP_OTP_HASH_SECRET = '   ';
        expect(hasUsableWhatsAppOtpHashSecret()).toBe(false);
        expect(() => hashWhatsappOtp('123456')).toThrow('WHATSAPP_OTP_HASH_SECRET is not configured');
    });

    test('a configured secret is the key in every environment; development falls back to its own key', () => {
        delete process.env.WHATSAPP_OTP_HASH_SECRET;
        Object.assign(process.env, { NODE_ENV: 'development' });
        expect(hasUsableWhatsAppOtpHashSecret()).toBe(true);
        const developmentHash = hashWhatsappOtp('123456');

        process.env.WHATSAPP_OTP_HASH_SECRET = 'configured-secret';
        const configuredHash = hashWhatsappOtp('123456');
        expect(configuredHash).not.toBe(developmentHash);

        Object.assign(process.env, { NODE_ENV: 'production' });
        expect(hasUsableWhatsAppOtpHashSecret()).toBe(true);
        expect(hashWhatsappOtp('123456')).toBe(configuredHash);
    });
});

