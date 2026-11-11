// Browser-only measurement facade. Never import server exporters from this module.
import { sendFrontendMetric } from '@/lib/performanceClient';
import { measureWithExporter, type ClientOperation } from '@/lib/performanceCore';

export async function measurePerformance<T>(operation: ClientOperation, run: () => Promise<T>, _legacyMetadata?: Record<string, unknown>): Promise<T> {
    void _legacyMetadata;
    return measureWithExporter(operation, run, async sample => {
        await sendFrontendMetric({ operation, value: sample.value, success: sample.outcome === 'success' });
    });
}
