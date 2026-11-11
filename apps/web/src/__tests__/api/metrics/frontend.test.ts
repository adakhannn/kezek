import { POST } from '@/app/api/metrics/frontend/route';
import { recordPerformanceSample } from '@/lib/performanceStore';
import { withRateLimit } from '@/lib/rateLimit';
jest.mock('@/lib/performanceStore', () => ({ recordPerformanceSample: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({ RateLimitConfigs: { normal: { maxRequests: 30, windowMs: 60000 } }, withRateLimit: jest.fn((_req, _config, handler) => handler()) }));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(recordPerformanceSample).mockResolvedValue(undefined); });
test('public collector stays in its own mandatory route budget and client namespace', async () => {
    const req = new Request('https://unit.invalid/api/metrics/frontend', { method: 'POST', body: JSON.stringify({ operation: 'LCP', value: 1200, success: true }) });
    expect((await POST(req)).status).toBe(200);
    expect(withRateLimit).toHaveBeenCalledWith(req, { maxRequests: 30, windowMs: 60000 }, expect.any(Function), '/api/metrics/frontend');
    expect(recordPerformanceSample).toHaveBeenCalledWith('client', { operation: 'LCP', value: 1200, outcome: 'success' });
});
test('limiter denial precedes metric persistence', async () => {
    jest.mocked(withRateLimit).mockResolvedValueOnce(new Response('denied', { status: 429 }));
    expect((await POST(new Request('https://unit.invalid/api/metrics/frontend', { method: 'POST', body: '{}' }))).status).toBe(429);
    expect(recordPerformanceSample).not.toHaveBeenCalled();
});
