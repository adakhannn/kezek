import 'server-only';
import { logWarn } from '@/lib/log';
import { measureWithExporter, type ServerOperation } from '@/lib/performanceCore';
import { recordPerformanceSample } from '@/lib/performanceStore';

export async function measurePerformance<T>(operation: ServerOperation, run: () => Promise<T>, _legacyMetadata?: Record<string, unknown>): Promise<T> {
    // Metadata is deliberately never recorded or logged. Keep the third argument
    // temporarily compatible with existing callers without trusting its contents.
    void _legacyMetadata;
    return measureWithExporter(operation, run, async sample => {
        try { await recordPerformanceSample('server', sample); }
        catch { logWarn('Performance', 'Shared metric export failed', { operation }); }
    });
}
