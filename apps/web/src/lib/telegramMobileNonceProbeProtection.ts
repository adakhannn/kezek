type NonceProbeEntry = {
    count: number;
    resetAt: number;
    blockedUntil: number;
};

const probeStore = new Map<string, NonceProbeEntry>();

const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_INVALID_NONCE_ATTEMPTS = 10;

function nowMs() {
    return Date.now();
}

function cleanupExpiredEntries() {
    const now = nowMs();
    for (const [identifier, entry] of probeStore.entries()) {
        if (entry.resetAt <= now && entry.blockedUntil <= now) {
            probeStore.delete(identifier);
        }
    }
}

if (typeof setInterval !== 'undefined' && typeof window === 'undefined') {
    const interval = setInterval(cleanupExpiredEntries, 60 * 1000);
    interval.unref?.();
}

export function isNonceProbeBlocked(identifier: string): {
    blocked: boolean;
    retryAfterSec?: number;
} {
    const entry = probeStore.get(identifier);
    if (!entry) {
        return { blocked: false };
    }

    const now = nowMs();
    if (entry.blockedUntil > now) {
        return {
            blocked: true,
            retryAfterSec: Math.ceil((entry.blockedUntil - now) / 1000),
        };
    }

    return { blocked: false };
}

export function registerInvalidNonceProbe(identifier: string) {
    const now = nowMs();
    const current = probeStore.get(identifier);

    if (!current || current.resetAt <= now) {
        probeStore.set(identifier, {
            count: 1,
            resetAt: now + WINDOW_MS,
            blockedUntil: 0,
        });
        return;
    }

    const nextCount = current.count + 1;
    const blockedUntil =
        nextCount >= MAX_INVALID_NONCE_ATTEMPTS ? now + BLOCK_MS : current.blockedUntil;

    probeStore.set(identifier, {
        ...current,
        count: nextCount,
        blockedUntil,
    });
}

export function clearNonceProbeState(identifier: string) {
    probeStore.delete(identifier);
}

export function __resetNonceProbeProtectionForTests() {
    probeStore.clear();
}

