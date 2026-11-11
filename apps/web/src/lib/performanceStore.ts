import 'server-only';
import { getUpstashRedisToken, getUpstashRedisUrl } from '@/lib/env';
import { histogramPercentile, isAllowedOperation, metricBounds, SERIES, type MetricSource, type PerformanceSample, type PerformanceStat } from '@/lib/performanceCore';

export const PERFORMANCE_TIMEOUT_MS = 500;
export const PERFORMANCE_RETENTION_MINUTES = 15;
export const PERFORMANCE_WINDOW_MINUTES = 5;
const PREFIX = 'performance:v1:';

// Redis TIME owns bucket placement. Input timestamps and process clocks cannot
// select a bucket or lengthen retention. One bounded hash per series/minute.
export const PERFORMANCE_WRITE_SCRIPT = `
local time = redis.call('TIME')
local minute = math.floor(tonumber(time[1]) / 60)
local key = KEYS[1] .. ':' .. minute
local count = tonumber(redis.call('HGET', key, 'count') or '0')
if count >= 10000000 then redis.call('EXPIREAT', key, (minute + 15) * 60); return 0 end
local value = tonumber(ARGV[1])
redis.call('HINCRBY', key, 'count', 1)
redis.call('EXPIREAT', key, (minute + 15) * 60)
redis.call('HINCRBY', key, ARGV[2], 1)
redis.call('HINCRBYFLOAT', key, 'sum', value)
redis.call('HINCRBY', key, 'b' .. ARGV[3], 1)
local minimum = tonumber(redis.call('HGET', key, 'min') or tostring(value))
local maximum = tonumber(redis.call('HGET', key, 'max') or tostring(value))
redis.call('HSET', key, 'min', math.min(minimum, value), 'max', math.max(maximum, value))
return 1
`;

// Five completed minutes, excluding the current partial minute. Bounded work:
// 15 fixed series x 5 buckets x 22 fields; no SCAN, raw events or dynamic labels.
export const PERFORMANCE_READ_SCRIPT = `
local time = redis.call('TIME')
local minute = math.floor(tonumber(time[1]) / 60)
local rows = {}
for _, prefix in ipairs(KEYS) do
  local count, errors, unknown, sum, minimum, maximum = 0, 0, 0, 0, nil, nil
  local histogram = {}
  for i = 0, 15 do histogram[i + 1] = 0 end
  for bucket = minute - 5, minute - 1 do
    local key = prefix .. ':' .. bucket
    local values = redis.call('HMGET', key, 'count', 'error', 'unknown', 'sum', 'min', 'max')
    local n = tonumber(values[1] or '0')
    if n > 0 then
      count = count + n
      errors = errors + tonumber(values[2] or '0')
      unknown = unknown + tonumber(values[3] or '0')
      sum = sum + tonumber(values[4] or '0')
      local low, high = tonumber(values[5]), tonumber(values[6])
      minimum = minimum and math.min(minimum, low) or low
      maximum = maximum and math.max(maximum, high) or high
      for i = 0, 15 do histogram[i + 1] = histogram[i + 1] + tonumber(redis.call('HGET', key, 'b' .. i) or '0') end
    end
  end
  local row = {count, errors, unknown, tostring(sum), tostring(minimum or 0), tostring(maximum or 0)}
  for i = 1, 16 do row[#row + 1] = histogram[i] end
  rows[#rows + 1] = row
end
return {tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000), (minute - 5) * 60000, minute * 60000, rows}
`;

export class PerformanceStoreUnavailable extends Error {
    constructor() { super('Shared performance metrics unavailable'); }
}

async function evaluate(script: string, keys: string[], args: (number | string)[]): Promise<unknown> {
    const url = getUpstashRedisUrl();
    const token = getUpstashRedisToken();
    if (!url || !token) throw new PerformanceStoreUnavailable();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const operation = (async () => {
            const { Redis } = await import('@upstash/redis');
            return new Redis({ url, token, retry: false, enableAutoPipelining: false, enableTelemetry: false, signal: controller.signal }).eval(script, keys, args);
        })();
        const deadline = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new PerformanceStoreUnavailable()); }, PERFORMANCE_TIMEOUT_MS);
        });
        return await Promise.race([operation, deadline]);
    } catch { throw new PerformanceStoreUnavailable(); }
    finally { if (timer) clearTimeout(timer); }
}

export async function recordPerformanceSample(source: MetricSource, sample: PerformanceSample): Promise<void> {
    if (!isAllowedOperation(source, sample.operation) || !Number.isFinite(sample.value) || sample.value < 0 ||
        sample.value > metricBounds(sample.operation).at(-1)! || !['success', 'error', 'unknown'].includes(sample.outcome)) throw new PerformanceStoreUnavailable();
    const bucket = metricBounds(sample.operation).findIndex(limit => sample.value <= limit);
    const result = await evaluate(PERFORMANCE_WRITE_SCRIPT, [`${PREFIX}${source}:${sample.operation}`], [sample.value, sample.outcome, bucket]);
    if (result !== 1) throw new PerformanceStoreUnavailable();
}

export type PerformanceSnapshot = { stats: PerformanceStat[]; timestamp: number; windowStart: number; windowEnd: number; status: 'observed' | 'no_data'; storage: 'shared-redis'; percentilesApproximate: true };
export async function readPerformanceSnapshot(): Promise<PerformanceSnapshot> {
    const value = await evaluate(PERFORMANCE_READ_SCRIPT, SERIES.map(series => `${PREFIX}${series.source}:${series.operation}`), []);
    if (!Array.isArray(value) || value.length !== 4) throw new PerformanceStoreUnavailable();
    const [timestamp, windowStart, windowEnd, rows] = value;
    if (![timestamp, windowStart, windowEnd].every(item => typeof item === 'number' && Number.isSafeInteger(item) && item > 0) ||
        windowEnd % 60000 !== 0 || windowEnd - windowStart !== PERFORMANCE_WINDOW_MINUTES * 60000 || timestamp < windowEnd || timestamp >= windowEnd + 60000 ||
        !Array.isArray(rows) || rows.length !== SERIES.length) throw new PerformanceStoreUnavailable();
    const stats: PerformanceStat[] = [];
    rows.forEach((raw: unknown, index: number) => {
        if (!Array.isArray(raw) || raw.length !== 22 || raw.some(item => !['number', 'string'].includes(typeof item) || item === '')) throw new PerformanceStoreUnavailable();
        const numbers = raw.map(Number);
        if (numbers.some(item => !Number.isFinite(item) || item < 0)) throw new PerformanceStoreUnavailable();
        const [count, errors, unknownCount, sum, minDuration, maxDuration, ...histogram] = numbers;
        if (![count, errors, unknownCount, ...histogram].every(Number.isSafeInteger) || count > 50000000 || errors + unknownCount > count ||
            histogram.reduce((total, n) => total + n, 0) !== count || minDuration > maxDuration) throw new PerformanceStoreUnavailable();
        if (!count) {
            if (sum || minDuration || maxDuration) throw new PerformanceStoreUnavailable();
            return;
        }
        const series = SERIES[index];
        const bounds = metricBounds(series.operation);
        if (maxDuration > bounds.at(-1)! || sum < minDuration * count - 0.001 || sum > maxDuration * count + 0.001) throw new PerformanceStoreUnavailable();
        stats.push({ ...series, unit: series.operation === 'CLS' ? 'score' : 'ms', count, unknownCount,
            avgDuration: sum / count, minDuration, maxDuration,
            p95Duration: histogramPercentile(bounds, histogram, count, 0.95), p99Duration: histogramPercentile(bounds, histogram, count, 0.99),
            errorRate: errors / count, percentilesApproximate: true });
    });
    return { stats, timestamp, windowStart, windowEnd, status: stats.length ? 'observed' : 'no_data', storage: 'shared-redis', percentilesApproximate: true };
}
