/** Small per-process cache for JSON report payloads. Never a correctness store. */
export class BoundedJsonCache {
    private readonly entries = new Map<string, { json: string; expiresAt: number; bytes: number }>();
    private bytes = 0;

    constructor(private readonly limits = { maxEntries: 256, maxBytes: 4 * 1024 * 1024 }) {
        if (!Number.isSafeInteger(limits.maxEntries) || limits.maxEntries < 1 ||
            !Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 1) {
            throw new Error('Cache limits must be positive integers');
        }
    }

    get size(): number { return this.entries.size; }
    get payloadBytes(): number { return this.bytes; }

    private delete(key: string): void {
        const entry = this.entries.get(key);
        if (!entry) return;
        this.bytes -= entry.bytes;
        this.entries.delete(key);
    }

    get<T>(key: string): T | null {
        const entry = this.entries.get(key);
        if (!entry) return null;
        if (entry.expiresAt <= Date.now()) {
            this.delete(key);
            return null;
        }
        this.entries.delete(key);
        this.entries.set(key, entry);
        return JSON.parse(entry.json) as T;
    }

    set<T>(key: string, value: T, ttlMs: number): void {
        this.delete(key);
        if (!Number.isFinite(ttlMs) || ttlMs <= 0 || key.length > 1024) return;
        const now = Date.now();
        for (const [existingKey, entry] of this.entries) {
            if (entry.expiresAt <= now) this.delete(existingKey);
        }
        let json: string | undefined;
        try { json = JSON.stringify(value); } catch { return; }
        if (json === undefined) return;
        // UTF-16 upper bound for retained string payloads, excluding bounded Map overhead.
        const bytes = 2 * (key.length + json.length);
        if (bytes > this.limits.maxBytes) return;
        while (this.entries.size >= this.limits.maxEntries || this.bytes + bytes > this.limits.maxBytes) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined) break;
            this.delete(oldest);
        }
        this.entries.set(key, { json, bytes, expiresAt: now + Math.min(ttlMs, 600_000) });
        this.bytes += bytes;
    }
}

const cache = new BoundedJsonCache();
export function getCached<T>(key: string): T | null { return cache.get<T>(key); }
export function setCached<T>(key: string, value: T, ttlMs: number): void { cache.set(key, value, ttlMs); }
