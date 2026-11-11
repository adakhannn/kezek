jest.mock('@/lib/env', () => ({ getUpstashRedisUrl: jest.fn(), getUpstashRedisToken: jest.fn() }));
jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn() }));
import { Redis } from '@upstash/redis';
import { getUpstashRedisUrl, getUpstashRedisToken } from '@/lib/env';
import { logWarn } from '@/lib/log';
import { checkRateLimit, withRateLimit, checkVerifiedPrincipalRateLimit, getRateLimitIdentifier,
    getTrustedRateLimitIdentifier, routeRateLimit, RateLimitConfigs, RATE_LIMIT_TIMEOUT_MS,
    RATE_LIMIT_MEMORY_CAP, RATE_LIMIT_SCRIPT } from '@/lib/rateLimit';

const req = (path = '/api/test', method = 'POST', headers: Record<string, string> = {}) =>
    new Request('https://example.com' + path, { method, headers });
const config = (identifier: string) => ({ maxRequests: 2, windowMs: 60000, identifier });
const originalMode = process.env.NODE_ENV;
const originalProxy = process.env.RATE_LIMIT_TRUSTED_IP_HEADER;
const redis = (value: unknown = [1, 60000]) => {
    (getUpstashRedisUrl as jest.Mock).mockReturnValue('https://synthetic.redis.invalid');
    (getUpstashRedisToken as jest.Mock).mockReturnValue('synthetic-token');
    const evalMock = jest.fn().mockResolvedValue(value);
    (Redis as jest.Mock).mockImplementation(() => ({ eval: evalMock }));
    return evalMock;
};
beforeEach(() => {
    jest.clearAllMocks();
    (logWarn as jest.Mock).mockReset();
    process.env.NODE_ENV = 'test';
    delete process.env.RATE_LIMIT_TRUSTED_IP_HEADER;
    (getUpstashRedisUrl as jest.Mock).mockReturnValue(undefined);
    (getUpstashRedisToken as jest.Mock).mockReturnValue(undefined);
});
afterEach(() => {
    jest.useRealTimers();
    process.env.NODE_ENV = originalMode;
    if (originalProxy === undefined) delete process.env.RATE_LIMIT_TRUSTED_IP_HEADER;
    else process.env.RATE_LIMIT_TRUSTED_IP_HEADER = originalProxy;
});

test('memory counter rejects the next request and starts a fresh window at exact expiry', async () => {
    jest.useFakeTimers().setSystemTime(100000);
    const options = { ...config('memory-expiry'), maxRequests: 1, windowMs: 2000 };
    expect((await checkRateLimit(req(), options, '/memory')).success).toBe(true);
    expect(await checkRateLimit(req(), options, '/memory')).toMatchObject({ success: false, remaining: 0, retryAfter: 2 });
    jest.setSystemTime(102000);
    expect((await checkRateLimit(req(), options, '/memory')).success).toBe(true);
});

test('method and route template isolate budgets; query and dynamic IDs cannot bypass one route', async () => {
    const options = { ...config('same-client'), maxRequests: 1 };
    expect((await checkRateLimit(req('/api/items/a?x=1'), options, '/api/items/[id]')).success).toBe(true);
    expect((await checkRateLimit(req('/api/items/b?x=2'), options, '/api/items/[id]')).success).toBe(false);
    expect((await checkRateLimit(req('/api/items/b', 'GET'), options, '/api/items/[id]')).success).toBe(true);
    expect((await checkRateLimit(req('/api/finance'), options, '/api/finance')).success).toBe(true);
});

test('one EVAL is used with no retries/pipelining and millisecond TTL arguments', async () => {
    const evaluate = redis([1, 500]);
    const result = await checkRateLimit(req(), { ...config('one-eval'), windowMs: 500 }, '/eval');
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith(RATE_LIMIT_SCRIPT, [expect.stringMatching(/^ratelimit:v2:POST:\/eval:/)], [500, 2]);
    expect(Redis).toHaveBeenCalledWith(expect.objectContaining({ retry: false, enableAutoPipelining: false,
        enableTelemetry: false, signal: expect.any(AbortSignal) }));
    expect(result).toMatchObject({ success: true, remaining: 1 });
    expect(evaluate.mock.calls[0][1][0]).not.toContain('one-eval');
});

test('Redis limit response provides a rounded positive Retry-After and never calls the handler', async () => {
    redis([3, 1001]);
    const handler = jest.fn(async () => new Response('ok'));
    const response = await withRateLimit(req(), config('blocked'), handler, '/blocked');
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('2');
    expect(handler).not.toHaveBeenCalled();
});

test.each([undefined, '', '   '])('production without complete Redis config fails closed (%j)', async value => {
    process.env.NODE_ENV = 'production';
    (getUpstashRedisUrl as jest.Mock).mockReturnValue(value);
    const handler = jest.fn(async () => new Response('should not happen'));
    const response = await withRateLimit(req(), config('prod-missing'), handler, '/prod');
    expect(response.status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
});

test.each([[null], [1], [0, 60000], [1, -1], [1, 60001], ['1', 60000], [1, Number.NaN]])('malformed Redis tuple %j is denied', async (...value) => {
    redis(value);
    expect(await checkRateLimit(req(), config('bad-reply'), '/bad')).toMatchObject({ success: false, unavailable: true });
});

test('Redis exception never resets a production budget into memory and logging failure stays closed', async () => {
    process.env.NODE_ENV = 'production';
    const evaluate = redis();
    evaluate.mockRejectedValue(new Error('network down'));
    (logWarn as jest.Mock).mockImplementation(() => { throw new Error('logger down'); });
    const response = await withRateLimit(req(), config('no-fallback'), async () => new Response('bad'), '/failure');
    expect(response.status).toBe(503);
});

test('hanging provider is aborted and returns 503 within the bounded deadline', async () => {
    jest.useFakeTimers();
    const evaluate = redis();
    evaluate.mockImplementation(() => new Promise(() => {}));
    const operation = withRateLimit(req(), config('timeout'), async () => new Response('bad'), '/timeout');
    await jest.advanceTimersByTimeAsync(RATE_LIMIT_TIMEOUT_MS);
    expect((await operation).status).toBe(503);
    const options = (Redis as jest.Mock).mock.calls.at(-1)[0];
    expect(options.signal.aborted).toBe(true);
});

test('constructor failure is unavailable, including when Redis is explicitly configured in development', async () => {
    redis();
    (Redis as jest.Mock).mockImplementation(() => { throw new Error('constructor'); });
    expect(await checkRateLimit(req(), config('constructor'), '/constructor')).toMatchObject({ unavailable: true });
});

test('no implicit trust of forwarded headers; configured single valid ingress address only', () => {
    process.env.NODE_ENV = 'production';
    expect(getTrustedRateLimitIdentifier(req('/', 'GET', { 'x-forwarded-for': '203.0.113.1' }))).toBeUndefined();
    process.env.RATE_LIMIT_TRUSTED_IP_HEADER = 'cf-connecting-ip';
    expect(getTrustedRateLimitIdentifier(req('/', 'GET', { 'x-forwarded-for': '203.0.113.1' }))).toBeUndefined();
    expect(getTrustedRateLimitIdentifier(req('/', 'GET', { 'cf-connecting-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(getTrustedRateLimitIdentifier(req('/', 'GET', { 'cf-connecting-ip': '203.0.113.1, 203.0.113.2' }))).toBeUndefined();
    expect(getTrustedRateLimitIdentifier(req('/', 'GET', { 'cf-connecting-ip': 'attacker' }))).toBeUndefined();
    process.env.RATE_LIMIT_TRUSTED_IP_HEADER = 'authorization';
    expect(getTrustedRateLimitIdentifier(req())).toBeUndefined();
});

test('production without a trusted ingress identity is denied before Redis', async () => {
    process.env.NODE_ENV = 'production';
    const evaluate = redis();
    expect(await checkRateLimit(req(), RateLimitConfigs.public, '/ingress')).toMatchObject({ unavailable: true });
    expect(evaluate).not.toHaveBeenCalled();
});

test('mobile attempt fingerprint compatibility remains unchanged and is separate from trusted identity', () => {
    const request = req('/', 'GET', { 'x-forwarded-for': '203.0.113.1, 10.0.0.1', 'x-real-ip': '203.0.113.2' });
    expect(getRateLimitIdentifier(request)).toBe('203.0.113.1');
    expect(getRateLimitIdentifier(req('/', 'GET', { 'x-real-ip': '203.0.113.2' }))).toBe('203.0.113.2');
    expect(getRateLimitIdentifier(req())).toBe('unknown');
});

test('verified users sharing NAT have separate primary budgets; tenant quota remains shared', async () => {
    const request = req('/', 'POST', { 'x-forwarded-for': '203.0.113.9' });
    const options = { maxRequests: 1, windowMs: 60000 };
    expect((await checkVerifiedPrincipalRateLimit(request, '/nat', { userId: 'a', bizId: 'biz-a' }, options)).success).toBe(true);
    expect((await checkVerifiedPrincipalRateLimit(request, '/nat', { userId: 'a', bizId: 'biz-a' }, options)).success).toBe(false);
    expect((await checkVerifiedPrincipalRateLimit(request, '/nat', { userId: 'b', bizId: 'biz-a' }, options)).success).toBe(true);
    for (let index = 0; index < 58; index++) expect((await checkVerifiedPrincipalRateLimit(request, '/nat', { userId: `u${index}`, bizId: 'biz-a' }, options)).success).toBe(true);
    expect((await checkVerifiedPrincipalRateLimit(request, '/nat', { userId: 'tenant-overflow', bizId: 'biz-a' }, options)).success).toBe(false);
    expect((await checkVerifiedPrincipalRateLimit(request, '/nat', { userId: 'a', bizId: 'biz-b' }, options)).success).toBe(true);
});

test('principal and tenant consume one EVAL, and missing verified principal never executes it', async () => {
    const evaluate = redis([1, 60000, 3, 60000]);
    expect((await checkVerifiedPrincipalRateLimit(req(), '/principal', { userId: 'u', bizId: 'b' }, RateLimitConfigs.critical)).success).toBe(true);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate.mock.calls[0][1]).toHaveLength(2);
    expect(evaluate.mock.calls[0][1][0]).not.toBe(evaluate.mock.calls[0][1][1]);
    expect(await checkVerifiedPrincipalRateLimit(req(), '/principal', { userId: '', bizId: 'b' }, RateLimitConfigs.critical)).toMatchObject({ unavailable: true });
    expect(evaluate).toHaveBeenCalledTimes(1);
});

test('response status, custom headers and narrower authenticated limit headers survive wrapping', async () => {
    const response = await withRateLimit(req(), config('response'), async () => new Response('{"ok":true}', {
        status: 201, headers: { 'X-Custom': 'yes', 'X-RateLimit-Limit': '1' },
    }), '/response');
    expect(response.status).toBe(201);
    expect(response.headers.get('X-Custom')).toBe('yes');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(await response.json()).toEqual({ ok: true });
    expect(routeRateLimit('poll', RateLimitConfigs.auth, { maxRequests: 20 })).toMatchObject({ keyPrefix: 'poll', maxRequests: 20 });
});

test('invalid route/config does not fall back to a shared budget', async () => {
    expect(await checkRateLimit(req(), config('invalid-route'), '')).toMatchObject({ unavailable: true });
    expect(await checkRateLimit(req(), { ...config('invalid-limit'), maxRequests: 0 }, '/invalid')).toMatchObject({ unavailable: true });
});

test('development store has a hard cap, preserves active counters, and reclaims expired entries', async () => {
    jest.useFakeTimers().setSystemTime(Date.now() + 86400000);
    const options = { maxRequests: 1, windowMs: 1000 };
    let denied = 0;
    for (let index = 0; index < RATE_LIMIT_MEMORY_CAP + 1; index++) {
        const result = await checkRateLimit(req(), { ...options, identifier: `bounded-${index}` }, '/bounded');
        if (result.unavailable) denied++;
    }
    expect(denied).toBeGreaterThan(0);
    expect((await checkRateLimit(req(), { ...options, identifier: 'bounded-0' }, '/bounded')).success).toBe(false);
    jest.advanceTimersByTime(1000);
    expect((await checkRateLimit(req(), { ...options, identifier: 'after-expiry' }, '/bounded')).success).toBe(true);
});
