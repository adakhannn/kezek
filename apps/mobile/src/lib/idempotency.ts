export type StableIdempotencyEntry = {
    fingerprint: string;
    key: string;
};

export function createIdempotencyKey(prefix: string): string {
    return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export function getStableIdempotencyKey(
    current: StableIdempotencyEntry | null,
    fingerprint: string,
    prefix: string,
): StableIdempotencyEntry {
    if (current?.fingerprint === fingerprint) return current;

    return {
        fingerprint,
        key: createIdempotencyKey(prefix),
    };
}
