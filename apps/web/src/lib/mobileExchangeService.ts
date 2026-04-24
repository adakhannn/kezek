import crypto from 'crypto';

import { logWarn } from '@/lib/log';

type StoredTokens = {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    createdAt: number;
    sequence: number;
};

type ExchangeFailure = {
    ok: false;
    error: 'not_found' | 'validation' | 'conflict';
    message: string;
    status: number;
};

const tokenStore = new Map<string, StoredTokens>();
const consumedTokenStore = new Map<string, number>();
let cleanupInterval: NodeJS.Timeout | null = null;
let creationSequence = 0;
const EXCHANGE_CODE_TTL_MS = 2 * 60 * 1000;
const CONSUMED_CODE_RETENTION_MS = 10 * 60 * 1000;

function nowMs() {
    return Date.now();
}

function randomCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function cleanupExpiredTokens() {
    const now = nowMs();

    for (const [code, data] of tokenStore.entries()) {
        if (data.expiresAt < now) {
            tokenStore.delete(code);
        }
    }
    for (const [code, consumedUntil] of consumedTokenStore.entries()) {
        if (consumedUntil < now) {
            consumedTokenStore.delete(code);
        }
    }

    if (tokenStore.size > 1000) {
        const entries = Array.from(tokenStore.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
        const toDelete = entries.slice(0, tokenStore.size - 1000);
        toDelete.forEach(([code]) => tokenStore.delete(code));
    }
}

function startCleanupInterval() {
    if (cleanupInterval) {
        return;
    }

    cleanupInterval = setInterval(cleanupExpiredTokens, 5 * 60 * 1000);
    cleanupInterval.unref?.();
}

startCleanupInterval();

export function storeMobileTokens({
    accessToken,
    refreshToken,
}: {
    accessToken: string;
    refreshToken: string;
}) {
    let code = randomCode();
    while (tokenStore.has(code)) {
        code = randomCode();
    }
    const now = nowMs();
    const expiresAt = now + EXCHANGE_CODE_TTL_MS;

    tokenStore.set(code, {
        accessToken,
        refreshToken,
        expiresAt,
        createdAt: now,
        sequence: ++creationSequence,
    });

    logWarn('MobileExchange', 'Token stored', {
        exchangeCode: code,
        expiresAt: new Date(expiresAt).toISOString(),
    });

    return { code };
}

export function getLatestPendingMobileExchange() {
    const now = nowMs();
    let latestCode: string | null = null;
    let latestCreatedAt = 0;
    let latestSequence = 0;

    for (const [code, data] of tokenStore.entries()) {
        if (
            data.expiresAt > now &&
            (data.createdAt > latestCreatedAt ||
                (data.createdAt === latestCreatedAt && data.sequence > latestSequence))
        ) {
            latestCode = code;
            latestCreatedAt = data.createdAt;
            latestSequence = data.sequence;
        }
    }

    if (!latestCode) {
        return null;
    }

    return {
        code: latestCode,
        createdAt: latestCreatedAt,
    };
}

export function exchangeMobileTokens(
    code: string
):
    | {
          ok: true;
          data: {
              accessToken: string;
              refreshToken: string;
          };
      }
    | ExchangeFailure {
    const tokenData = tokenStore.get(code);

    if (!tokenData) {
        if (consumedTokenStore.has(code)) {
            return {
                ok: false,
                error: 'conflict',
                message: 'Код уже использован',
                status: 409,
            };
        }

        return {
            ok: false,
            error: 'not_found',
            message: 'Неверный или истекший код',
            status: 404,
        };
    }

    if (tokenData.expiresAt < nowMs()) {
        tokenStore.delete(code);
        return {
            ok: false,
            error: 'validation',
            message: 'Код истек',
            status: 410,
        };
    }

    tokenStore.delete(code);
    consumedTokenStore.set(code, nowMs() + CONSUMED_CODE_RETENTION_MS);

    return {
        ok: true,
        data: {
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
        },
    };
}

export function __resetMobileExchangeStoreForTests() {
    tokenStore.clear();
    consumedTokenStore.clear();
    creationSequence = 0;
}

