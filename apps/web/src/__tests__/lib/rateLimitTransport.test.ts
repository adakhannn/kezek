jest.mock('@/lib/env', () => ({
    getUpstashRedisUrl: () => 'https://synthetic-redis.invalid',
    getUpstashRedisToken: () => 'synthetic-test-token',
}));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn() }));
import { checkRateLimit, RATE_LIMIT_SCRIPT, RATE_LIMIT_TIMEOUT_MS } from '@/lib/rateLimit';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

test('installed Upstash SDK sends one EVAL REST request with the script, keys and args', async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ result: [1, 60000] }), { status: 200 }));
    global.fetch = fetchMock;
    const result = await checkRateLimit(new Request('https://app.invalid/api/test', { method: 'POST' }),
        { maxRequests: 3, windowMs: 60000, identifier: 'verified-synthetic' }, '/api/test');
    expect(result).toMatchObject({ success: true, remaining: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const command = JSON.parse(String(options.body));
    expect(String(command[0]).toLowerCase()).toBe('eval');
    expect(command[1]).toBe(RATE_LIMIT_SCRIPT);
    expect(Number(command[2])).toBe(1);
    expect(command[3]).toMatch(/^ratelimit:v2:POST:\/api\/test:/);
    expect(command.slice(4).map(Number)).toEqual([60000, 3]);
});

test('installed SDK observes abort and makes no transport retry after the deadline', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn((_input: RequestInfo | URL, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    global.fetch = fetchMock;
    const result = checkRateLimit(new Request('https://app.invalid/api/test'),
        { maxRequests: 3, windowMs: 60000, identifier: 'verified-synthetic' }, '/api/test');
    await jest.advanceTimersByTimeAsync(RATE_LIMIT_TIMEOUT_MS + 100);
    expect(await result).toMatchObject({ success: false, unavailable: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
});
