/** Client-safe definitions. No environment, provider, user identifiers or metadata. */
export const SERVER_OPERATIONS = ['shift_close', 'shift_close_dashboard', 'apply_promotion', 'update_booking_status', 'recalculate_ratings'] as const;
export const CLIENT_OPERATIONS = ['get_free_slots_service_day_v2', 'get_free_slots_complex_day_v1', 'get_free_slots_page_v1', 'LCP', 'FCP', 'TTFB', 'INP', 'CLS', 'page_load', 'render'] as const;
export type ServerOperation = typeof SERVER_OPERATIONS[number];
export type ClientOperation = typeof CLIENT_OPERATIONS[number];
export type MetricOperation = ServerOperation | ClientOperation;
export type MetricSource = 'server' | 'client';
export type MetricOutcome = 'success' | 'error' | 'unknown';
export type PerformanceSample = { operation: MetricOperation; value: number; outcome: MetricOutcome };
export const DURATION_BOUNDS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000, 300000, 3600000] as const;
export const CLS_BOUNDS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.25, 0.5, 1, 2, 5, 10, 50, 100] as const;
export const SERIES = [
    ...SERVER_OPERATIONS.map(operation => ({ source: 'server' as const, operation })),
    ...CLIENT_OPERATIONS.map(operation => ({ source: 'client' as const, operation })),
];
export const metricBounds = (operation: MetricOperation): readonly number[] => operation === 'CLS' ? CLS_BOUNDS : DURATION_BOUNDS;
export function isAllowedOperation(source: MetricSource, operation: unknown): operation is MetricOperation {
    return (source === 'server' || source === 'client') && typeof operation === 'string' && (source === 'server' ? SERVER_OPERATIONS : CLIENT_OPERATIONS).some(value => value === operation);
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function explicitFailure(value: unknown): boolean {
    return record(value) && (value.ok === false || value.success === false || (value.error !== undefined && value.error !== null && value.error !== false));
}

/** The measured operation is the RPC call, not the entire enclosing user workflow. */
export function classifyPerformanceResult(operation: MetricOperation, value: unknown): MetricOutcome {
    if (explicitFailure(value)) return 'error';
    if (!record(value) || !('error' in value)) return 'unknown';
    if (explicitFailure(value.data)) return 'error';
    // Close has an explicit command receipt; an empty or malformed receipt is not success.
    if (operation === 'shift_close' || operation === 'shift_close_dashboard') return record(value.data) && value.data.ok === true ? 'success' : 'unknown';
    return value.error === null ? 'success' : 'unknown';
}

export async function measureWithExporter<T>(operation: MetricOperation, run: () => Promise<T>, exportSample: (sample: PerformanceSample) => Promise<unknown>): Promise<T> {
    const start = performance.now();
    let outcome: MetricOutcome = 'error';
    try {
        const result = await run();
        outcome = classifyPerformanceResult(operation, result);
        return result;
    } finally {
        const value = Math.min(DURATION_BOUNDS.at(-1)!, Math.max(0, performance.now() - start));
        try { await exportSample({ operation, value, outcome }); } catch { /* Telemetry must never replace a business result or error. */ }
    }
}

export type FrontendMetric = { operation: ClientOperation; value: number; success: boolean };
export function parseFrontendMetric(value: unknown): FrontendMetric | null {
    if (!record(value) || Object.keys(value).sort().join(',') !== 'operation,success,value' ||
        !isAllowedOperation('client', value.operation) || typeof value.success !== 'boolean' ||
        typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0 ||
        value.value > metricBounds(value.operation).at(-1)!) return null;
    return value as FrontendMetric;
}

export type PerformanceStat = {
    source: MetricSource; operation: MetricOperation; unit: 'ms' | 'score';
    count: number; unknownCount: number; avgDuration: number; minDuration: number; maxDuration: number;
    p95Duration: number; p99Duration: number; errorRate: number; percentilesApproximate: true;
};
export function histogramPercentile(bounds: readonly number[], counts: readonly number[], total: number, percentile: number): number {
    const rank = Math.ceil(total * percentile);
    let cumulative = 0;
    for (let index = 0; index < counts.length; index++) {
        cumulative += counts[index];
        if (cumulative >= rank) return bounds[index];
    }
    throw new Error('Invalid metric histogram');
}
