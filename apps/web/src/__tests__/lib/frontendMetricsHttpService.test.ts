import { runFrontendMetricsHttp } from '@/lib/frontendMetricsHttpService';
import { recordPerformanceSample } from '@/lib/performanceStore';
jest.mock('@/lib/performanceStore', () => ({ recordPerformanceSample: jest.fn() }));
const request = (body: string) => new Request('https://unit.invalid/api/metrics/frontend', { method: 'POST', body });
beforeEach(() => { jest.clearAllMocks(); jest.mocked(recordPerformanceSample).mockResolvedValue(undefined); });
test('persists a bounded public client sample before acknowledging it', async () => {
    const response = await runFrontendMetricsHttp(request(JSON.stringify({ operation: 'page_load', value: 100, success: true })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { recorded: true, source: 'client' } });
});
test.each(['{', 'null', '[]', JSON.stringify({ operation: 'shift_close', value: 100, success: true }), JSON.stringify({ operation: 'CLS', value: 0.1, success: true, source: 'server' }), JSON.stringify({ operation: 'render', value: 100, success: true, timestamp: 1 }), ' '.repeat(1025)])('rejects malformed, excessive or forged data before Redis', async body => {
    expect((await runFrontendMetricsHttp(request(body))).status).toBe(400);
    expect(recordPerformanceSample).not.toHaveBeenCalled();
});
test('does not trust a dishonest Content-Length', async () => {
    const req = new Request('https://unit.invalid/metrics', { method: 'POST', body: 'x'.repeat(2048), headers: { 'Content-Length': '1' } });
    expect((await runFrontendMetricsHttp(req)).status).toBe(400);
    expect(recordPerformanceSample).not.toHaveBeenCalled();
});
test('returns 503 when the store cannot acknowledge the write', async () => {
    jest.mocked(recordPerformanceSample).mockRejectedValue(new Error('timeout'));
    expect((await runFrontendMetricsHttp(request(JSON.stringify({ operation: 'render', value: 100, success: true })))).status).toBe(503);
});
test('a stalled upload is bounded and never reaches storage', async () => {
    jest.useFakeTimers();
    try {
        const body = new ReadableStream<Uint8Array>({ start() {} });
        const req = new Request('https://unit.invalid/metrics', { method: 'POST', body, duplex: 'half' } as RequestInit);
        const pending = runFrontendMetricsHttp(req);
        await jest.advanceTimersByTimeAsync(1000);
        expect((await pending).status).toBe(400);
        expect(recordPerformanceSample).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
});
