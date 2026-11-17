/**
 * One-time sign-in handoff from the mobile app to the web cabinet.
 *
 * The app used to open `/auth/callback#access_token=…&refresh_token=…` with its
 * own session. Besides putting a long-lived refresh token into a browser URL,
 * that made the browser and the app share one refresh token: Supabase rotates
 * refresh tokens and revokes the whole session when a used one is presented
 * again, so whichever side refreshed second signed both out. Now the app trades
 * its bearer token for a short-lived, single-use code; redeeming it issues the
 * browser an independent session.
 */

import { createHash, randomBytes } from 'node:crypto';

import { sanitizeAuthReturnPath } from '@/lib/authReturnUrl';
import { getUpstashRedisToken, getUpstashRedisUrl } from '@/lib/env';

export const WEB_HANDOFF_TTL_SECONDS = 60;

/** 32 random bytes in base64url. */
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type WebHandoffStore = {
    /** Stores the value only if the key is new; resolves false otherwise. */
    put(key: string, value: string, ttlSeconds: number): Promise<boolean>;
    /** Atomically reads and deletes. */
    take(key: string): Promise<string | null>;
};

export type WebHandoffEntry = { userId: string; next: string };

// Only a hash of the code is stored, so the store never holds a usable credential.
const storageKey = (code: string) => `web-handoff:${createHash('sha256').update(code).digest('hex')}`;

export async function createWebHandoffCode(
    store: WebHandoffStore,
    userId: string,
    next: string | null | undefined,
): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    const entry: WebHandoffEntry = { userId, next: sanitizeAuthReturnPath(next) };
    if (!(await store.put(storageKey(code), JSON.stringify(entry), WEB_HANDOFF_TTL_SECONDS))) {
        throw new Error('WEB_HANDOFF_STORE_FAILED');
    }
    return code;
}

/** Single use: the entry is gone after the first redemption, valid or not. */
export async function redeemWebHandoffCode(store: WebHandoffStore, code: string): Promise<WebHandoffEntry | null> {
    if (!CODE_PATTERN.test(code)) return null;
    const raw = await store.take(storageKey(code));
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<WebHandoffEntry>;
        if (typeof parsed.userId !== 'string' || !parsed.userId) return null;
        return { userId: parsed.userId, next: sanitizeAuthReturnPath(parsed.next) };
    } catch {
        return null;
    }
}

const memory = new Map<string, { value: string; expiresAt: number }>();

/** Development and tests only: a per-process map with the same semantics. */
export const memoryWebHandoffStore: WebHandoffStore = {
    async put(key, value, ttlSeconds) {
        const now = Date.now();
        const existing = memory.get(key);
        if (existing && existing.expiresAt > now) return false;
        memory.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
        return true;
    },
    async take(key) {
        const entry = memory.get(key);
        memory.delete(key);
        return entry && entry.expiresAt > Date.now() ? entry.value : null;
    },
};

function redisWebHandoffStore(url: string, token: string): WebHandoffStore {
    const client = import('@upstash/redis').then(({ Redis }) =>
        // Raw strings: the entry is parsed and validated by redeemWebHandoffCode.
        new Redis({ url, token, automaticDeserialization: false, enableTelemetry: false }));
    return {
        async put(key, value, ttlSeconds) {
            return (await (await client).set(key, value, { nx: true, ex: ttlSeconds })) === 'OK';
        },
        async take(key) {
            const value = await (await client).getdel<string>(key);
            return typeof value === 'string' ? value : null;
        },
    };
}

/**
 * Shared Redis in deployments. Like the rate limiter, production without it
 * means the feature is unavailable rather than silently per-instance.
 */
export function getWebHandoffStore(): WebHandoffStore | null {
    const url = getUpstashRedisUrl();
    const token = getUpstashRedisToken();
    if (url && token) return redisWebHandoffStore(url, token);
    return process.env.NODE_ENV === 'production' ? null : memoryWebHandoffStore;
}
