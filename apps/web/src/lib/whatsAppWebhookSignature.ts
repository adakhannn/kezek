import { createHmac, timingSafeEqual } from 'node:crypto';

/** Meta signs the exact request bytes with the app secret, not the GET verify token. */
export function verifyWhatsAppWebhookSignature(
    body: Uint8Array,
    signature: string | null,
    appSecret: string,
): boolean {
    if (!appSecret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
    const expected = createHmac('sha256', appSecret).update(body).digest();
    const received = Buffer.from(signature.slice(7), 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
}
