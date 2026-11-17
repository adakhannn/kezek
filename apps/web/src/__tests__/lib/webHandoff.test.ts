const redisSet = jest.fn();
const redisGetdel = jest.fn();
const RedisCtor = jest.fn().mockImplementation(() => ({ set: redisSet, getdel: redisGetdel }));
jest.mock('@upstash/redis', () => ({ Redis: RedisCtor }));

import {
    createWebHandoffCode,
    getWebHandoffStore,
    memoryWebHandoffStore,
    redeemWebHandoffCode,
    WEB_HANDOFF_TTL_SECONDS,
    type WebHandoffStore,
} from '@/lib/webHandoff';

function recordingStore() {
    const data = new Map<string, string>();
    const store: WebHandoffStore & { data: Map<string, string>; take: jest.Mock; put: jest.Mock } = {
        data,
        put: jest.fn(async (key: string, value: string) => { if (data.has(key)) return false; data.set(key, value); return true; }),
        take: jest.fn(async (key: string) => { const value = data.get(key) ?? null; data.delete(key); return value; }),
    };
    return store;
}

describe('web handoff codes', () => {
    it('round-trips once and stores only a hash of the code', async () => {
        const store = recordingStore();
        const code = await createWebHandoffCode(store, 'user-1', '/select-business');

        expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(store.put).toHaveBeenCalledWith(expect.stringMatching(/^web-handoff:[a-f0-9]{64}$/), expect.any(String), WEB_HANDOFF_TTL_SECONDS);
        expect([...store.data.keys()].join()).not.toContain(code);

        await expect(redeemWebHandoffCode(store, code)).resolves.toEqual({ userId: 'user-1', next: '/select-business' });
        await expect(redeemWebHandoffCode(store, code)).resolves.toBeNull();
    });

    it('never stores or returns an external redirect target', async () => {
        const store = recordingStore();
        for (const next of ['https://evil.example/x', '//evil.example', '/\\evil', undefined]) {
            const code = await createWebHandoffCode(store, 'user-1', next);
            await expect(redeemWebHandoffCode(store, code)).resolves.toEqual({ userId: 'user-1', next: '/' });
        }
    });

    it('rejects malformed codes without touching the store', async () => {
        const store = recordingStore();
        for (const code of ['', 'short', 'x'.repeat(43) + '!', 'a b']) {
            await expect(redeemWebHandoffCode(store, code)).resolves.toBeNull();
        }
        expect(store.take).not.toHaveBeenCalled();
    });

    it('fails closed on a key collision or a corrupted entry', async () => {
        const store = recordingStore();
        store.put.mockResolvedValueOnce(false);
        await expect(createWebHandoffCode(store, 'user-1', '/')).rejects.toThrow('WEB_HANDOFF_STORE_FAILED');

        store.take.mockResolvedValueOnce('{not json');
        await expect(redeemWebHandoffCode(store, 'a'.repeat(43))).resolves.toBeNull();
        store.take.mockResolvedValueOnce(JSON.stringify({ next: '/' }));
        await expect(redeemWebHandoffCode(store, 'a'.repeat(43))).resolves.toBeNull();
    });

    it('memory store expires entries and is single use', async () => {
        jest.useFakeTimers();
        try {
            await memoryWebHandoffStore.put('k1', 'v', 1);
            await expect(memoryWebHandoffStore.put('k1', 'other', 1)).resolves.toBe(false);
            jest.advanceTimersByTime(1500);
            await expect(memoryWebHandoffStore.take('k1')).resolves.toBeNull();

            await memoryWebHandoffStore.put('k2', 'v', 60);
            await expect(memoryWebHandoffStore.take('k2')).resolves.toBe('v');
            await expect(memoryWebHandoffStore.take('k2')).resolves.toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('getWebHandoffStore', () => {
    const originalEnv = process.env;
    afterEach(() => { process.env = originalEnv; });

    it('uses Redis SET NX EX and GETDEL with raw strings when configured', async () => {
        process.env = { ...originalEnv, KV_REST_API_URL: 'https://redis.example.invalid', KV_REST_API_TOKEN: 'token' };
        redisSet.mockResolvedValue('OK');
        redisGetdel.mockResolvedValue('{"userId":"u","next":"/"}');
        const store = getWebHandoffStore()!;

        await expect(store.put('k', 'v', 60)).resolves.toBe(true);
        await expect(store.take('k')).resolves.toBe('{"userId":"u","next":"/"}');
        expect(RedisCtor).toHaveBeenCalledWith(expect.objectContaining({ automaticDeserialization: false }));
        expect(redisSet).toHaveBeenCalledWith('k', 'v', { nx: true, ex: 60 });
        expect(redisGetdel).toHaveBeenCalledWith('k');
    });

    it('is unavailable in production without Redis instead of falling back per instance', () => {
        process.env = { ...originalEnv, NODE_ENV: 'production' };
        delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
        delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;

        expect(getWebHandoffStore()).toBeNull();
    });
});
