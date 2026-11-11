import { measurePerformance } from '@/lib/performanceServer';
import { recordPerformanceSample } from '@/lib/performanceStore';
import { logWarn } from '@/lib/log';
jest.mock('@/lib/performanceStore', () => ({ recordPerformanceSample: jest.fn() }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test('resolved database errors are recorded as failure and all metadata is dropped', async () => {
    jest.mocked(recordPerformanceSample).mockResolvedValue(undefined);
    const result = { error: { message: 'sensitive database details' }, data: null };
    expect(await measurePerformance('apply_promotion', async () => result, { bookingId: 'private-id', token: 'secret' })).toBe(result);
    expect(recordPerformanceSample).toHaveBeenCalledWith('server', { operation: 'apply_promotion', value: expect.any(Number), outcome: 'error' });
    expect(logWarn).not.toHaveBeenCalled();
});
test('shared storage failure preserves the committed response and logs no provider details', async () => {
    jest.mocked(recordPerformanceSample).mockRejectedValue(new Error('credential-like unit detail'));
    const result = { error: null, data: { ok: true } };
    expect(await measurePerformance('shift_close', async () => result)).toBe(result);
    expect(logWarn).toHaveBeenCalledWith('Performance', 'Shared metric export failed', { operation: 'shift_close' });
});
