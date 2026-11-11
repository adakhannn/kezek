import { classifyPerformanceResult, histogramPercentile, measureWithExporter, parseFrontendMetric, DURATION_BOUNDS } from '@/lib/performanceCore';

test.each([
    [{ error: new Error('database failure'), data: null }, 'error'],
    [{ error: null, data: { ok: false } }, 'error'],
    [{ error: null, data: { success: false } }, 'error'],
    [{ ok: false }, 'error'],
    [{ success: false }, 'error'],
    [{ error: null, data: { error: 'rejected' } }, 'error'],
    [{ error: null, data: [] }, 'success'],
    [undefined, 'unknown'],
    [{ data: [] }, 'unknown'],
])('classifies resolved RPC outcome without equating resolution with success (%j)', (value, expected) => {
    expect(classifyPerformanceResult('recalculate_ratings', value)).toBe(expected);
});

test('Close requires its explicit successful command receipt', () => {
    expect(classifyPerformanceResult('shift_close', { error: null, data: null })).toBe('unknown');
    expect(classifyPerformanceResult('shift_close', { error: null, data: { ok: true } })).toBe('success');
});

test('exporter failure cannot replace the result of an already completed transaction', async () => {
    const result = { error: null, data: { ok: true } };
    const exporter = jest.fn().mockRejectedValue(new Error('Redis unavailable'));
    expect(await measureWithExporter('shift_close', async () => result, exporter)).toBe(result);
    expect(exporter).toHaveBeenCalledWith({ operation: 'shift_close', value: expect.any(Number), outcome: 'success' });
});

test('a thrown error remains the original error even if telemetry fails', async () => {
    const original = new Error('original business error');
    const exporter = jest.fn().mockRejectedValue(new Error('Redis unavailable'));
    await expect(measureWithExporter('shift_close', async () => { throw original; }, exporter)).rejects.toBe(original);
    expect(exporter).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'error' }));
});

test.each([
    { operation: 'shift_close', value: 100, success: true },
    { operation: 'render', value: 100, success: true, source: 'server' },
    { operation: 'render', value: 100, success: true, metadata: { bookingId: 'secret' } },
    { operation: 'render', value: -1, success: true },
    { operation: 'render', value: Infinity, success: true },
    { operation: 'render', value: 3600001, success: true },
    { operation: 'CLS', value: 101, success: true },
    { operation: 'render', value: 1, success: 'true' },
    { page: '/private/identifier', renderTime: 100 },
])('rejects forged server/PII/unbounded client payload (%j)', value => {
    expect(parseFrontendMetric(value)).toBeNull();
});

test('accepts only bounded client data, with separate CLS units', () => {
    expect(parseFrontendMetric({ operation: 'CLS', value: 0.1, success: true })).toEqual({ operation: 'CLS', value: 0.1, success: true });
    expect(parseFrontendMetric({ operation: 'get_free_slots_page_v1', value: 120, success: false })).not.toBeNull();
});

test('histogram percentile is the containing bucket upper bound, not fabricated exact duration', () => {
    const histogram = DURATION_BOUNDS.map((_, index) => index === 2 ? 94 : index === 4 ? 6 : 0);
    expect(histogramPercentile(DURATION_BOUNDS, histogram, 100, 0.95)).toBe(50);
    expect(histogramPercentile(DURATION_BOUNDS, histogram, 100, 0.99)).toBe(50);
});
