import 'server-only';
import { parseFrontendMetric } from '@/lib/performanceCore';
import { recordPerformanceSample } from '@/lib/performanceStore';

export async function saveFrontendMetric(input: unknown): Promise<'saved' | 'invalid' | 'unavailable'> {
    const metric = parseFrontendMetric(input);
    if (!metric) return 'invalid';
    try {
        await recordPerformanceSample('client', { operation: metric.operation, value: metric.value, outcome: metric.success ? 'success' : 'error' });
        return 'saved';
    } catch { return 'unavailable'; }
}
