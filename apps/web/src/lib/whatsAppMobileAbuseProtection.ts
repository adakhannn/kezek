type WindowCounter = {
    count: number;
    resetAt: number;
};

const counters = new Map<string, WindowCounter>();

function nowMs() {
    return Date.now();
}

function key(parts: Array<string | null | undefined>) {
    return parts.filter(Boolean).join(':');
}

function hitCounter(counterKey: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
    const now = nowMs();
    const current = counters.get(counterKey);
    if (!current || current.resetAt <= now) {
        counters.set(counterKey, { count: 1, resetAt: now + windowMs });
        return { ok: true };
    }

    current.count += 1;
    if (current.count > limit) {
        return { ok: false, retryAfterSec: Math.ceil((current.resetAt - now) / 1000) };
    }
    return { ok: true };
}

export function checkWhatsAppMobileStartAbuse({
    identifier,
    phone,
}: {
    identifier: string;
    phone: string;
}) {
    const byPhone = hitCounter(key(['wa', 'start', 'phone', phone]), 5, 15 * 60 * 1000);
    if (!byPhone.ok) {
        return { ok: false as const, reason: 'phone_rate_limit', retryAfterSec: byPhone.retryAfterSec };
    }

    const byIpAndEndpoint = hitCounter(key(['wa', 'start', 'ip', identifier]), 20, 15 * 60 * 1000);
    if (!byIpAndEndpoint.ok) {
        return { ok: false as const, reason: 'ip_rate_limit', retryAfterSec: byIpAndEndpoint.retryAfterSec };
    }

    return { ok: true as const };
}

export function checkWhatsAppMobileVerifyAbuse({
    identifier,
    attemptId,
}: {
    identifier: string;
    attemptId: string;
}) {
    const byAttempt = hitCounter(key(['wa', 'verify', 'attempt', attemptId]), 10, 10 * 60 * 1000);
    if (!byAttempt.ok) {
        return { ok: false as const, reason: 'attempt_rate_limit', retryAfterSec: byAttempt.retryAfterSec };
    }

    const byIpAndEndpoint = hitCounter(key(['wa', 'verify', 'ip', identifier]), 40, 15 * 60 * 1000);
    if (!byIpAndEndpoint.ok) {
        return { ok: false as const, reason: 'ip_rate_limit', retryAfterSec: byIpAndEndpoint.retryAfterSec };
    }

    return { ok: true as const };
}

export function __resetWhatsAppMobileAbuseProtectionForTests() {
    counters.clear();
}

