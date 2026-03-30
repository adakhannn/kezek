jest.mock('@/lib/env', () => ({
    getUpstashRedisUrl: jest.fn(),
    getUpstashRedisToken: jest.fn(),
}));

jest.mock('@upstash/redis', () => ({
    Redis: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
    logWarn: jest.fn(),
}));

import { Redis } from '@upstash/redis';

import { getUpstashRedisToken, getUpstashRedisUrl } from '@/lib/env';
import { logWarn } from '@/lib/log';
import {
    RateLimitConfigs,
    checkRateLimit,
    getRateLimitIdentifier,
    routeRateLimit,
    withRateLimit,
} from '@/lib/rateLimit';

function createRequest(headers: Record<string, string> = {}): Request {
    return new Request('https://example.com', {
        headers,
    });
}

describe('rateLimit', () => {
    const mockedRedis = Redis as jest.Mock;
    const mockedGetRedisUrl = getUpstashRedisUrl as jest.MockedFunction<
        typeof getUpstashRedisUrl
    >;
    const mockedGetRedisToken = getUpstashRedisToken as jest.MockedFunction<
        typeof getUpstashRedisToken
    >;
    const mockedLogWarn = logWarn as jest.MockedFunction<typeof logWarn>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetRedisUrl.mockReturnValue('');
        mockedGetRedisToken.mockReturnValue('');
    });

    test('uses in-memory fallback and blocks after maxRequests', async () => {
        const req = createRequest({ 'x-forwarded-for': '10.0.0.1' });
        const config = { maxRequests: 2, windowMs: 60_000, identifier: 'memory-basic' };

        const first = await checkRateLimit(req, config);
        const second = await checkRateLimit(req, config);
        const third = await checkRateLimit(req, config);

        expect(first).toMatchObject({ success: true, remaining: 1, limit: 2 });
        expect(second).toMatchObject({ success: true, remaining: 0, limit: 2 });
        expect(third.success).toBe(false);
        expect(third.retryAfter).toBeGreaterThan(0);
    });

    test('restarts in-memory window after expiration', async () => {
        const nowSpy = jest.spyOn(Date, 'now');
        nowSpy
            .mockReturnValueOnce(1_000)
            .mockReturnValueOnce(1_100)
            .mockReturnValueOnce(4_500);

        const req = createRequest({ 'x-forwarded-for': '10.0.0.2' });
        const config = { maxRequests: 1, windowMs: 2_000, identifier: 'memory-expired' };

        const first = await checkRateLimit(req, config);
        const blocked = await checkRateLimit(req, config);
        const expiredWindow = await checkRateLimit(req, config);

        expect(first.success).toBe(true);
        expect(blocked.success).toBe(false);
        expect(expiredWindow).toMatchObject({ success: true, remaining: 0, limit: 1 });

        nowSpy.mockRestore();
    });

    test('uses redis backend when Upstash env is configured', async () => {
        mockedGetRedisUrl.mockReturnValue('https://upstash.example');
        mockedGetRedisToken.mockReturnValue('token');

        const redisClient = {
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn().mockResolvedValue(1),
            ttl: jest.fn().mockResolvedValue(60),
        };
        mockedRedis.mockImplementation(() => redisClient);

        const result = await checkRateLimit(
            createRequest({ 'x-forwarded-for': '10.0.0.3' }),
            { maxRequests: 3, windowMs: 60_000, identifier: 'redis-success', keyPrefix: 'api/test' },
        );

        expect(mockedRedis).toHaveBeenCalledWith({
            url: 'https://upstash.example',
            token: 'token',
        });
        expect(redisClient.incr).toHaveBeenCalledWith('ratelimit:api/test:redis-success');
        expect(redisClient.expire).toHaveBeenCalledWith('ratelimit:api/test:redis-success', 60);
        expect(redisClient.ttl).toHaveBeenCalledWith('ratelimit:api/test:redis-success');
        expect(result).toMatchObject({ success: true, limit: 3, remaining: 2 });
    });

    test('returns retryAfter when redis over-limit branch is hit', async () => {
        mockedGetRedisUrl.mockReturnValue('https://upstash.example');
        mockedGetRedisToken.mockReturnValue('token');

        const redisClient = {
            incr: jest.fn().mockResolvedValue(5),
            expire: jest.fn(),
            ttl: jest.fn().mockResolvedValue(17),
        };
        mockedRedis.mockImplementation(() => redisClient);

        const result = await checkRateLimit(
            createRequest({ 'x-forwarded-for': '10.0.0.4' }),
            { maxRequests: 2, windowMs: 60_000, identifier: 'redis-blocked' },
        );

        expect(result).toMatchObject({
            success: false,
            limit: 2,
            remaining: 0,
            retryAfter: 17,
        });
        expect(redisClient.expire).not.toHaveBeenCalled();
    });

    test('falls back to in-memory when redis client setup fails', async () => {
        mockedGetRedisUrl.mockReturnValue('https://upstash.example');
        mockedGetRedisToken.mockReturnValue('token');
        mockedRedis.mockImplementation(() => {
            throw new Error('constructor failed');
        });

        const result = await checkRateLimit(
            createRequest({ 'x-forwarded-for': '10.0.0.5' }),
            { maxRequests: 1, windowMs: 60_000, identifier: 'redis-constructor-fallback' },
        );

        expect(result).toMatchObject({ success: true, remaining: 0, limit: 1 });
        expect(mockedLogWarn).toHaveBeenCalledWith(
            'RateLimit',
            '@upstash/redis not available, using in-memory fallback',
            expect.any(Error),
        );
    });

    test('falls back to in-memory when redis operations throw', async () => {
        mockedGetRedisUrl.mockReturnValue('https://upstash.example');
        mockedGetRedisToken.mockReturnValue('token');

        const redisClient = {
            incr: jest.fn().mockRejectedValue(new Error('network down')),
            expire: jest.fn(),
            ttl: jest.fn(),
        };
        mockedRedis.mockImplementation(() => redisClient);

        const result = await checkRateLimit(
            createRequest({ 'x-forwarded-for': '10.0.0.6' }),
            { maxRequests: 1, windowMs: 60_000, identifier: 'redis-runtime-fallback' },
        );

        expect(result).toMatchObject({ success: true, remaining: 0, limit: 1 });
        expect(mockedLogWarn).toHaveBeenCalledWith(
            'RateLimit',
            'Redis error, falling back to in-memory',
            expect.any(Error),
        );
    });

    test('withRateLimit returns 429 response and survives logging failure', async () => {
        mockedLogWarn.mockImplementation(() => {
            throw new Error('logger unavailable');
        });

        const req = createRequest({ 'x-forwarded-for': '10.0.0.7' });
        const config = { maxRequests: 1, windowMs: 60_000, identifier: 'with-limit' };
        const handler = jest.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

        const firstRes = await withRateLimit(req, config, handler);
        const secondRes = await withRateLimit(req, config, handler);

        expect(firstRes.status).toBe(200);
        expect(secondRes.status).toBe(429);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(secondRes.headers.get('Retry-After')).not.toBeNull();
        await expect(secondRes.json()).resolves.toMatchObject({
            ok: false,
            error: 'rate_limit_exceeded',
        });
    });

    test('withRateLimit preserves handler response and appends rate-limit headers', async () => {
        const response = await withRateLimit(
            createRequest({ 'x-forwarded-for': '10.0.0.8' }),
            { maxRequests: 3, windowMs: 60_000, identifier: 'with-success' },
            async () =>
                new Response(JSON.stringify({ ok: true }), {
                    status: 201,
                    statusText: 'Created',
                    headers: { 'Content-Type': 'application/json', 'X-Custom': 'yes' },
                }),
        );

        expect(response.status).toBe(201);
        expect(response.statusText).toBe('Created');
        expect(response.headers.get('X-Custom')).toBe('yes');
        expect(response.headers.get('X-RateLimit-Limit')).toBe('3');
        await expect(response.json()).resolves.toEqual({ ok: true });
    });

    test('routeRateLimit keeps base config and applies overrides', () => {
        const config = routeRateLimit('api/notify', RateLimitConfigs.normal, { maxRequests: 20 });

        expect(config).toEqual({
            maxRequests: 20,
            windowMs: RateLimitConfigs.normal.windowMs,
            keyPrefix: 'api/notify',
        });
    });

    test('getRateLimitIdentifier prefers forwarded header and falls back through known headers', () => {
        expect(
            getRateLimitIdentifier(
                createRequest({ 'x-forwarded-for': '203.0.113.1, 198.51.100.9' }),
            ),
        ).toBe('203.0.113.1');
        expect(getRateLimitIdentifier(createRequest({ 'x-real-ip': '203.0.113.2' }))).toBe(
            '203.0.113.2',
        );
        expect(
            getRateLimitIdentifier(createRequest({ 'cf-connecting-ip': '203.0.113.3' })),
        ).toBe('203.0.113.3');
        expect(getRateLimitIdentifier(createRequest())).toBe('unknown');
    });
});
