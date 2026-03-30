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
    error: 'not_found' | 'validation';
    message: string;
    status: number;
};

const tokenStore = new Map<string, StoredTokens>();
let cleanupInterval: NodeJS.Timeout | null = null;
let creationSequence = 0;

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
}

startCleanupInterval();

export function storeMobileTokens({
    accessToken,
    refreshToken,
}: {
    accessToken: string;
    refreshToken: string;
}) {
    const code = randomCode();
    const now = nowMs();

    tokenStore.set(code, {
        accessToken,
        refreshToken,
        expiresAt: now + 10 * 60 * 1000,
        createdAt: now,
        sequence: ++creationSequence,
    });

    logWarn('MobileExchange', 'Token stored', {
        code,
        expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
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
    creationSequence = 0;
}
