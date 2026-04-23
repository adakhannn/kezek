import crypto from 'crypto';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const REPLAY_TTL_MS = 10 * 60 * 1000;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const HEX_SHA256_RE = /^[a-fA-F0-9]{64}$/;

const replayStore = new Map<string, number>();

type VerifyResult =
    | { ok: true }
    | {
          ok: false;
          status: 400 | 401 | 409 | 503;
          error: 'validation' | 'auth' | 'conflict' | 'service_unavailable';
          message: string;
      };

function nowMs() {
    return Date.now();
}

function cleanupReplayStore() {
    const now = nowMs();
    for (const [requestId, expiresAt] of replayStore.entries()) {
        if (expiresAt <= now) {
            replayStore.delete(requestId);
        }
    }
}

function safeEqualHex(a: string, b: string) {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
}

function buildSignaturePayload(
    timestampSec: string,
    requestId: string,
    bodyRaw: string,
) {
    return `${timestampSec}.${requestId}.${bodyRaw}`;
}

export function computeTelegramMobileBotRequestSignature(params: {
    secret: string;
    timestampSec: string;
    requestId: string;
    bodyRaw: string;
}) {
    const payload = buildSignaturePayload(
        params.timestampSec,
        params.requestId,
        params.bodyRaw,
    );
    return crypto
        .createHmac('sha256', params.secret)
        .update(payload)
        .digest('hex');
}

export function createTelegramMobileBotRequestAuthHeaders(params: {
    secret: string;
    bodyRaw: string;
    now?: number;
    requestId?: string;
}) {
    const now = params.now ?? nowMs();
    const timestampSec = String(Math.floor(now / 1000));
    const requestId =
        params.requestId ?? crypto.randomBytes(12).toString('base64url');
    const signature = computeTelegramMobileBotRequestSignature({
        secret: params.secret,
        timestampSec,
        requestId,
        bodyRaw: params.bodyRaw,
    });

    return {
        'x-telegram-bot-secret': params.secret,
        'x-telegram-bot-timestamp': timestampSec,
        'x-telegram-bot-request-id': requestId,
        'x-telegram-bot-signature': signature,
    };
}

export function verifyTelegramMobileBotRequestAuth(params: {
    expectedSecret: string;
    botSecret?: string | null;
    timestampHeader?: string | null;
    requestIdHeader?: string | null;
    signatureHeader?: string | null;
    bodyRaw: string;
}): VerifyResult {
    cleanupReplayStore();

    const expectedSecret = params.expectedSecret.trim();
    if (!expectedSecret) {
        return {
            ok: false,
            status: 503,
            error: 'service_unavailable',
            message: 'Telegram mobile confirm временно недоступен',
        };
    }

    if (!params.botSecret || !safeEqualHex(expectedSecret, params.botSecret)) {
        return {
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Неверный секрет подтверждения',
        };
    }

    const timestampSec = (params.timestampHeader || '').trim();
    const requestId = (params.requestIdHeader || '').trim();
    const providedSignature = (params.signatureHeader || '')
        .trim()
        .replace(/^sha256=/i, '');

    if (!timestampSec || !/^\d{10}$/.test(timestampSec)) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Некорректный timestamp подписи запроса',
        };
    }

    if (!requestId || !REQUEST_ID_RE.test(requestId)) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Некорректный request id подписи запроса',
        };
    }

    if (!providedSignature || !HEX_SHA256_RE.test(providedSignature)) {
        return {
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Некорректная подпись запроса',
        };
    }

    const timestampMs = Number(timestampSec) * 1000;
    const now = nowMs();
    if (Math.abs(now - timestampMs) > MAX_CLOCK_SKEW_MS) {
        return {
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Подпись запроса просрочена',
        };
    }

    const expectedSignature = computeTelegramMobileBotRequestSignature({
        secret: expectedSecret,
        timestampSec,
        requestId,
        bodyRaw: params.bodyRaw,
    });
    if (!safeEqualHex(expectedSignature, providedSignature)) {
        return {
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Неверная подпись запроса',
        };
    }

    const replayUntil = replayStore.get(requestId);
    if (replayUntil && replayUntil > now) {
        return {
            ok: false,
            status: 409,
            error: 'conflict',
            message: 'Повтор запроса отклонен',
        };
    }

    replayStore.set(requestId, now + REPLAY_TTL_MS);

    return { ok: true };
}

export function __resetTelegramMobileBotRequestReplayStoreForTests() {
    replayStore.clear();
}
