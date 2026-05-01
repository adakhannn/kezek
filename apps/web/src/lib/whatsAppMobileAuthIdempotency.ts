type IdempotentEntry<T> = {
    expiresAt: number;
    payload: T;
};

const store = new Map<string, IdempotentEntry<unknown>>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function nowMs() {
    return Date.now();
}

function cleanup() {
    const now = nowMs();
    for (const [key, entry] of store.entries()) {
        if (entry.expiresAt <= now) {
            store.delete(key);
        }
    }
}

export function buildWhatsAppMobileIdempotencyKey(parts: Array<string | null | undefined>) {
    return parts
        .filter((part): part is string => !!part && part.trim().length > 0)
        .map((part) => part.trim())
        .join(':');
}

export function readWhatsAppMobileIdempotency<T>(key: string): T | null {
    cleanup();
    const entry = store.get(key);
    if (!entry) {
        return null;
    }
    return entry.payload as T;
}

export function writeWhatsAppMobileIdempotency<T>(key: string, payload: T, ttlMs = DEFAULT_TTL_MS) {
    cleanup();
    store.set(key, {
        payload,
        expiresAt: nowMs() + ttlMs,
    });
}

export function __resetWhatsAppMobileIdempotencyForTests() {
    store.clear();
}

