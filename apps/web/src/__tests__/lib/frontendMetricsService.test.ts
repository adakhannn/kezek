import { saveFrontendMetric } from '@/lib/frontendMetricsService';
import { recordPerformanceSample } from '@/lib/performanceStore';
jest.mock('@/lib/performanceStore', () => ({ recordPerformanceSample: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(recordPerformanceSample).mockResolvedValue(undefined); });
test('exports only a validated client sample with no caller identity', async () => {
    expect(await saveFrontendMetric({ operation: 'CLS', value: 0.1, success: true })).toBe('saved');
    expect(recordPerformanceSample).toHaveBeenCalledWith('client', { operation: 'CLS', value: 0.1, outcome: 'success' });
});
test.each([{ operation: 'shift_close', value: 1, success: true }, { operation: 'render', value: 1, success: true, url: '/private' }, null, []])('rejects invalid/forged sample before storage (%j)', async input => {
    expect(await saveFrontendMetric(input)).toBe('invalid');
    expect(recordPerformanceSample).not.toHaveBeenCalled();
});
test('reports a failed write as unavailable instead of successful acceptance', async () => {
    jest.mocked(recordPerformanceSample).mockRejectedValue(new Error('unit failure'));
    expect(await saveFrontendMetric({ operation: 'render', value: 100, success: false })).toBe('unavailable');
});
