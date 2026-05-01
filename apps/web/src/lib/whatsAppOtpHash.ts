import crypto from 'crypto';

import { getWhatsAppOtpHashSecret } from '@/lib/env';

function hmac(value: string) {
    return crypto
        .createHmac('sha256', getWhatsAppOtpHashSecret())
        .update(value)
        .digest('hex');
}

export function hashWhatsappOtp(code: string) {
    return hmac(`otp:${code}`);
}

export function hashWhatsappPhone(phoneE164: string) {
    return hmac(`phone:${phoneE164}`);
}

export function secureEqualHex(left: string, right: string) {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

