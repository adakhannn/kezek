import crypto from 'crypto';

import { formatTelegramMobileStartPayload } from '@/lib/telegramMobileDeepLinkPayload';
import { trackTelegramMobileMetric } from '@/lib/telegramMobileMetricsService';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_STORE_SIZE = 5000;
const EXPIRED_RETENTION_MS = 15 * 60 * 1000;

export type TelegramMobileAuthAttemptStatus =
    | 'pending'
    | 'consumed'
    | 'approved'
    | 'failed'
    | 'expired';

export type TelegramMobileAuthSourceMeta = {
    appName?: string | null;
    device?: string | null;
    region?: string | null;
    platform?: string | null;
    userAgent?: string | null;
};

export type TelegramMobileAuthAttempt = {
    nonce: string;
    status: TelegramMobileAuthAttemptStatus;
    createdAt: number;
    expiresAt: number;
    telegramId?: number;
    userId?: string;
    linkage?: 'existing' | 'created';
    exchangeCode?: string;
    consumedAt?: number;
    failureReason?: string;
    source?: TelegramMobileAuthSourceMeta;
    expectedTelegramId?: number;
    telegramChatId?: number;
    telegramUsername?: string;
    telegramFirstName?: string;
    telegramLastName?: string;
};

const attemptsStore = new Map<string, TelegramMobileAuthAttempt>();
let cleanupInterval: NodeJS.Timeout | null = null;

function nowMs() {
    return Date.now();
}

function cleanupExpiredAttempts() {
    const now = nowMs();

    for (const [nonce, attempt] of attemptsStore.entries()) {
        if (attempt.expiresAt <= now && attempt.status === 'pending') {
            attemptsStore.set(nonce, {
                ...attempt,
                status: 'expired',
            });
            void trackTelegramMobileMetric('telegram_mobile_login_expired', {
                nonce,
                telegramId: attempt.telegramId ?? null,
                metadata: {
                    reason: 'ttl_cleanup',
                },
            });
            continue;
        }

        if (attempt.expiresAt + EXPIRED_RETENTION_MS <= now) {
            attemptsStore.delete(nonce);
        }
    }

    if (attemptsStore.size > MAX_STORE_SIZE) {
        const oldest = [...attemptsStore.values()]
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(0, attemptsStore.size - MAX_STORE_SIZE);

        oldest.forEach((attempt) => attemptsStore.delete(attempt.nonce));
    }
}

function startCleanupInterval() {
    if (cleanupInterval) {
        return;
    }

    cleanupInterval = setInterval(cleanupExpiredAttempts, 60 * 1000);
    cleanupInterval.unref?.();
}

function generateNonce() {
    return crypto.randomBytes(24).toString('base64url');
}

function buildBotDeepLink(botUsername: string, nonce: string) {
    const startPayload = formatTelegramMobileStartPayload(nonce);
    return `https://t.me/${botUsername}?start=${startPayload}`;
}

startCleanupInterval();

export function createTelegramMobileAuthAttempt({
    botUsername,
    ttlMs = DEFAULT_TTL_MS,
    source,
}: {
    botUsername: string;
    ttlMs?: number;
    source?: TelegramMobileAuthSourceMeta;
}) {
    const now = nowMs();
    const expiresAt = now + ttlMs;

    let nonce = generateNonce();
    while (attemptsStore.has(nonce)) {
        nonce = generateNonce();
    }

    attemptsStore.set(nonce, {
        nonce,
        status: 'pending',
        createdAt: now,
        expiresAt,
        source,
    });
    void trackTelegramMobileMetric('telegram_mobile_login_started', {
        nonce,
        metadata: {
            appName: source?.appName ?? null,
            platform: source?.platform ?? null,
        },
    });

    return {
        nonce,
        botDeepLink: buildBotDeepLink(botUsername, nonce),
        expiresAt,
    };
}

export function getTelegramMobileAuthAttempt(nonce: string) {
    const attempt = attemptsStore.get(nonce);
    if (!attempt) {
        return null;
    }

    if (attempt.status === 'pending' && attempt.expiresAt <= nowMs()) {
        const expiredAttempt: TelegramMobileAuthAttempt = {
            ...attempt,
            status: 'expired',
            failureReason: attempt.failureReason ?? 'attempt_expired',
        };
        attemptsStore.set(nonce, expiredAttempt);
        void trackTelegramMobileMetric('telegram_mobile_login_expired', {
            nonce,
            telegramId: attempt.telegramId ?? null,
            metadata: {
                reason: 'ttl_read_attempt',
            },
        });
        return expiredAttempt;
    }

    return attempt;
}

export function getTelegramMobileAuthStatus(nonce: string): {
    status: TelegramMobileAuthAttemptStatus;
    expiresAt: number | null;
    exchangeCode?: string;
} {
    const attempt = attemptsStore.get(nonce);

    if (!attempt) {
        return {
            status: 'failed',
            expiresAt: null,
        };
    }

    if (attempt.status === 'pending' && attempt.expiresAt <= nowMs()) {
        const expiredAttempt: TelegramMobileAuthAttempt = {
            ...attempt,
            status: 'expired',
        };
        attemptsStore.set(nonce, expiredAttempt);
        void trackTelegramMobileMetric('telegram_mobile_login_expired', {
            nonce,
            telegramId: attempt.telegramId ?? null,
            metadata: {
                reason: 'ttl_status_poll',
            },
        });
        return {
            status: 'expired',
            expiresAt: expiredAttempt.expiresAt,
        };
    }

    const status = attempt.status === 'consumed' ? 'pending' : attempt.status;

    return {
        status,
        expiresAt: attempt.expiresAt,
        exchangeCode: attempt.exchangeCode,
    };
}

export function consumePendingTelegramMobileAuthAttempt(nonce: string): {
    ok: true;
    attempt: TelegramMobileAuthAttempt;
} | {
    ok: false;
    error: 'not_found' | 'expired' | 'invalid_status';
} {
    const attempt = attemptsStore.get(nonce);
    if (!attempt) {
        return { ok: false, error: 'not_found' };
    }

    if (attempt.status !== 'pending') {
        return { ok: false, error: 'invalid_status' };
    }

    if (attempt.consumedAt) {
        return { ok: false, error: 'invalid_status' };
    }

    if (attempt.expiresAt <= nowMs()) {
        attemptsStore.set(nonce, {
            ...attempt,
            status: 'expired',
            failureReason: 'attempt_expired',
        });
        void trackTelegramMobileMetric('telegram_mobile_login_expired', {
            nonce,
            telegramId: attempt.telegramId ?? null,
            metadata: {
                reason: 'ttl_consume',
            },
        });
        return { ok: false, error: 'expired' };
    }

    const consumedAt = nowMs();
    const consumedAttempt: TelegramMobileAuthAttempt = {
        ...attempt,
        status: 'consumed',
        consumedAt,
    };
    attemptsStore.set(nonce, consumedAttempt);

    return { ok: true, attempt: consumedAttempt };
}

export function markTelegramMobileAuthAttemptApproved({
    nonce,
    telegramId,
    userId,
    exchangeCode,
    linkage,
}: {
    nonce: string;
    telegramId: number;
    userId: string;
    exchangeCode: string;
    linkage: 'existing' | 'created';
}) {
    const attempt = attemptsStore.get(nonce);
    if (!attempt) {
        return;
    }

    attemptsStore.set(nonce, {
        ...attempt,
        status: 'approved',
        telegramId,
        userId,
        linkage,
        exchangeCode,
        failureReason: undefined,
    });
    void trackTelegramMobileMetric('telegram_mobile_login_approved', {
        nonce,
        telegramId,
        metadata: {
            linkage,
        },
    });
}

export function markTelegramMobileAuthAttemptFailed({
    nonce,
    reason,
}: {
    nonce: string;
    reason: string;
}) {
    const attempt = attemptsStore.get(nonce);
    if (!attempt) {
        return;
    }

    attemptsStore.set(nonce, {
        ...attempt,
        status: 'failed',
        failureReason: reason,
    });
    void trackTelegramMobileMetric('telegram_mobile_login_failed', {
        nonce,
        telegramId: attempt.telegramId ?? null,
        metadata: {
            reason,
        },
    });
}

export function attachTelegramMobileAuthAttemptTelegramContext({
    nonce,
    telegramId,
    chatId,
    username,
    firstName,
    lastName,
}: {
    nonce: string;
    telegramId: number;
    chatId: number;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
}): {
    ok: true;
    attempt: TelegramMobileAuthAttempt;
} | {
    ok: false;
    error: 'not_found' | 'expired' | 'invalid_status' | 'already_bound_other_telegram';
} {
    const attempt = getTelegramMobileAuthAttempt(nonce);
    if (!attempt) {
        return { ok: false, error: 'not_found' };
    }

    if (attempt.status === 'expired') {
        return { ok: false, error: 'expired' };
    }

    if (attempt.status !== 'pending') {
        return { ok: false, error: 'invalid_status' };
    }

    if (attempt.expectedTelegramId && attempt.expectedTelegramId !== telegramId) {
        return { ok: false, error: 'already_bound_other_telegram' };
    }

    const updated: TelegramMobileAuthAttempt = {
        ...attempt,
        expectedTelegramId: telegramId,
        telegramChatId: chatId,
        telegramUsername: username?.trim() || undefined,
        telegramFirstName: firstName?.trim() || undefined,
        telegramLastName: lastName?.trim() || undefined,
    };
    attemptsStore.set(nonce, updated);

    return {
        ok: true,
        attempt: updated,
    };
}

export function __resetTelegramMobileAuthAttemptsForTests() {
    attemptsStore.clear();
}

export function __setTelegramMobileAuthAttemptStatusForTests(
    nonce: string,
    status: TelegramMobileAuthAttemptStatus,
    options?: {
        exchangeCode?: string;
        telegramId?: number;
        userId?: string;
        linkage?: 'existing' | 'created';
    },
) {
    const attempt = attemptsStore.get(nonce);
    if (!attempt) {
        return;
    }

    attemptsStore.set(nonce, {
        ...attempt,
        status,
        exchangeCode: options?.exchangeCode ?? attempt.exchangeCode,
        telegramId: options?.telegramId ?? attempt.telegramId,
        userId: options?.userId ?? attempt.userId,
        linkage: options?.linkage ?? attempt.linkage,
    });
}
