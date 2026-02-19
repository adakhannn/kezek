import { checkRateLimit, withRateLimit } from '@/lib/rateLimit';

function createRequest(ip: string = '127.0.0.1'): Request {
  return new Request('https://example.com', {
    headers: {
      'x-forwarded-for': ip,
    },
  });
}

describe('rateLimit (in-memory fallback)', () => {
  test('checkRateLimit allows up to maxRequests in window and then blocks', async () => {
    const req = createRequest('10.0.0.1');
    const config = { maxRequests: 2, windowMs: 60_000, identifier: 'test-check' };

    const first = await checkRateLimit(req, config);
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(1);

    const second = await checkRateLimit(req, config);
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(0);

    const third = await checkRateLimit(req, config);
    expect(third.success).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfter).toBeGreaterThan(0);
  });

  test('withRateLimit returns 429 and proper headers when limit exceeded', async () => {
    const req = createRequest('10.0.0.2');
    const config = { maxRequests: 1, windowMs: 60_000, identifier: 'test-with' };

    const handler = jest.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const firstRes = await withRateLimit(req, config, handler);
    expect(firstRes.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(firstRes.headers.get('X-RateLimit-Limit')).toBe(String(config.maxRequests));

    const secondRes = await withRateLimit(req, config, handler);
    expect(secondRes.status).toBe(429);
    const body = await secondRes.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('rate_limit_exceeded');
    expect(secondRes.headers.get('X-RateLimit-Limit')).toBe(String(config.maxRequests));
    expect(secondRes.headers.get('Retry-After')).not.toBeNull();
  });
}


