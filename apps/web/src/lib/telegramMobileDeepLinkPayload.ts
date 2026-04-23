const TELEGRAM_START_PREFIX = 'km1_';
const NONCE_RE = /^[A-Za-z0-9_-]{20,128}$/;

export function formatTelegramMobileStartPayload(nonce: string): string {
    const normalized = nonce.trim();
    if (!NONCE_RE.test(normalized)) {
        throw new Error('Invalid nonce format for Telegram deep-link payload');
    }

    return `${TELEGRAM_START_PREFIX}${normalized}`;
}

export function parseTelegramMobileStartPayload(payload: string): {
    nonce: string;
    version: 'km1';
} | null {
    const normalized = payload.trim();
    if (!normalized.startsWith(TELEGRAM_START_PREFIX)) {
        return null;
    }

    const nonce = normalized.slice(TELEGRAM_START_PREFIX.length);
    if (!NONCE_RE.test(nonce)) {
        return null;
    }

    return {
        nonce,
        version: 'km1',
    };
}

