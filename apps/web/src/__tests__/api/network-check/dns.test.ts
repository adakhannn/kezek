/**
 * GET /api/network-check/dns: resolves only the fixed Supabase host, takes no input, is rate-limited,
 * never cached, and answers a failure with a safe message (R25-31).
 */
const resolve4 = jest.fn();
const resolve6 = jest.fn();
jest.mock('node:dns/promises', () => ({
    Resolver: jest.fn().mockImplementation(() => ({ resolve4, resolve6 })),
}));

import { GET } from '@/app/api/network-check/dns/route';
import { DNS_LOOKUP_FAILED_MESSAGE } from '@/lib/networkCheckDnsService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

const request = () => new Request('https://kezek.vercel.app/api/network-check/dns?host=evil.example.com&name=x', {
    headers: { 'x-host': 'evil.example.com', 'user-agent': 'probe-test' },
});

beforeEach(() => {
    jest.clearAllMocks();
    resolve4.mockResolvedValue(['104.18.38.10', '172.64.149.246']);
    resolve6.mockResolvedValue(['2606:4700::6812:260a']);
});

test('resolves only the host of the server Supabase URL and ignores every request input', async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { host: 'test.supabase.co', ipv4: ['104.18.38.10', '172.64.149.246'],
        ipv6: ['2606:4700::6812:260a'], ms: expect.any(Number) } });
    expect(resolve4).toHaveBeenCalledTimes(1);
    expect(resolve4).toHaveBeenCalledWith('test.supabase.co');
    expect(resolve6).toHaveBeenCalledWith('test.supabase.co');
    expect(JSON.stringify(body)).not.toContain('evil');
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
});

test('a missing AAAA record still answers with the IPv4 addresses', async () => {
    resolve6.mockRejectedValue(Object.assign(new Error('queryAaaa ENODATA test.supabase.co'), { code: 'ENODATA' }));
    const body = await (await GET(request())).json();
    expect(body.data.ipv4).toEqual(['104.18.38.10', '172.64.149.246']);
    expect(body.data.ipv6).toEqual([]);
});

test('runs under the public rate limit of its own route', async () => {
    await GET(request());
    expect(withRateLimit).toHaveBeenCalledWith(expect.any(Request), RateLimitConfigs.public, expect.any(Function),
        '/api/network-check/dns');
});

test('a denied limiter answers without resolving, still not cached', async () => {
    (withRateLimit as jest.Mock).mockImplementationOnce(async () => new Response(
        JSON.stringify({ ok: false, error: 'rate_limit_exceeded' }), { status: 429 }));
    const res = await GET(request());
    expect(res.status).toBe(429);
    expect(resolve4).not.toHaveBeenCalled();
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
});

test('a failed lookup returns the safe message and only the resolver error code', async () => {
    const failure = Object.assign(new Error('queryA ETIMEOUT test.supabase.co internal-resolver-10.0.0.2'), { code: 'ETIMEOUT' });
    resolve4.mockRejectedValue(failure);
    resolve6.mockRejectedValue(failure);
    const res = await GET(request());
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: 'dns_failed', message: DNS_LOOKUP_FAILED_MESSAGE,
        details: { code: 'ETIMEOUT', ms: expect.any(Number) } });
    expect(JSON.stringify(body)).not.toContain('10.0.0.2');
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
});
