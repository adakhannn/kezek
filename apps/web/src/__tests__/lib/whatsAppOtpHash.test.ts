import { hashWhatsappOtp, hashWhatsappPhone, secureEqualHex } from '@/lib/whatsAppOtpHash';

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
});

