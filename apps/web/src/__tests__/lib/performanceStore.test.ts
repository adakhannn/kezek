import { PERFORMANCE_READ_SCRIPT, PERFORMANCE_WRITE_SCRIPT, PERFORMANCE_TIMEOUT_MS, readPerformanceSnapshot, recordPerformanceSample } from '@/lib/performanceStore';
import { SERIES } from '@/lib/performanceCore';
import { getUpstashRedisToken, getUpstashRedisUrl } from '@/lib/env';
import { Redis } from '@upstash/redis';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/env', () => ({ getUpstashRedisToken: jest.fn(), getUpstashRedisUrl: jest.fn() }));
jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }));
const evaluate = jest.fn();
const end = 1800000000000;
const row = () => [0, 0, 0, '0', '0', '0', ...Array(16).fill(0)];
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getUpstashRedisUrl).mockReturnValue('https://redis.unit.invalid');
    jest.mocked(getUpstashRedisToken).mockReturnValue('synthetic-token');
    jest.mocked(Redis).mockImplementation(() => ({ eval: evaluate }) as never);
    evaluate.mockResolvedValue(1);
});
afterEach(() => jest.useRealTimers());

test('write uses one EVAL, fixed source/operation, no app timestamp or metadata, and disabled retries', async () => {
    await recordPerformanceSample('server', { operation: 'shift_close', value: 50, outcome: 'error' });
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith(PERFORMANCE_WRITE_SCRIPT, ['performance:v1:server:shift_close'], [50, 'error', 4]);
    expect(Redis).toHaveBeenCalledWith(expect.objectContaining({ retry: false, enableAutoPipelining: false, enableTelemetry: false, signal: expect.any(AbortSignal) }));
});

test('client cannot select a server metric key', async () => {
    await expect(recordPerformanceSample('client', { operation: 'shift_close', value: 1, outcome: 'success' })).rejects.toThrow('unavailable');
    expect(evaluate).not.toHaveBeenCalled();
});

test('a reachable empty shared store is no_data with a Redis-owned completed-minute window', async () => {
    evaluate.mockResolvedValue([end + 1234, end - 300000, end, SERIES.map(row)]);
    const snapshot = await readPerformanceSnapshot();
    expect(snapshot).toMatchObject({ status: 'no_data', stats: [], timestamp: end + 1234, windowStart: end - 300000, windowEnd: end });
    expect(evaluate).toHaveBeenCalledWith(PERFORMANCE_READ_SCRIPT, expect.arrayContaining(['performance:v1:server:shift_close', 'performance:v1:client:CLS']), []);
    expect(evaluate).toHaveBeenCalledTimes(1);
});

test('parses aggregate errors, unknowns and approximate histogram percentiles', async () => {
    const rows = SERIES.map(row);
    rows[0] = [4, 1, 1, '100', '10', '50', ...Array.from({ length: 16 }, (_, index) => index === 2 ? 2 : index === 4 ? 2 : 0)];
    evaluate.mockResolvedValue([end + 1, end - 300000, end, rows]);
    expect((await readPerformanceSnapshot()).stats[0]).toEqual({ source: 'server', operation: 'shift_close', unit: 'ms', count: 4, unknownCount: 1, avgDuration: 25, minDuration: 10, maxDuration: 50, p95Duration: 50, p99Duration: 50, errorRate: 0.25, percentilesApproximate: true });
});

test('missing credentials has no memory success fallback', async () => {
    jest.mocked(getUpstashRedisToken).mockReturnValue('');
    await expect(readPerformanceSnapshot()).rejects.toThrow('unavailable');
    expect(Redis).not.toHaveBeenCalled();
});

test.each([null, [], [end, end - 300000, end, []]])('invalid backend result stays unavailable (%j)', async value => {
    evaluate.mockResolvedValue(value);
    await expect(readPerformanceSnapshot()).rejects.toThrow('unavailable');
});

test('corrupt histograms cannot produce healthy-looking stats', async () => {
    const rows = SERIES.map(row); rows[0][0] = 1;
    evaluate.mockResolvedValue([end, end - 300000, end, rows]);
    await expect(readPerformanceSnapshot()).rejects.toThrow('unavailable');
});

test('deadline aborts a hung provider without retry or memory fallback', async () => {
    jest.useFakeTimers();
    evaluate.mockReturnValue(new Promise(() => undefined));
    const pending = readPerformanceSnapshot();
    const failure = expect(pending).rejects.toThrow('unavailable');
    await jest.advanceTimersByTimeAsync(PERFORMANCE_TIMEOUT_MS);
    await failure;
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(jest.mocked(Redis).mock.calls[0][0]?.signal?.aborted).toBe(true);
});
