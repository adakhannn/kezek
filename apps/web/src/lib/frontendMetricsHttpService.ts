import type { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { saveFrontendMetric } from '@/lib/frontendMetricsService';

/** Bound bytes even when Content-Length is absent or dishonest. */
async function readMetricBody(req: Request): Promise<unknown> {
    const reader = req.body?.getReader();
    if (!reader) throw new Error('Missing body');
    const decoder = new TextDecoder();
    let bytes = 0;
    let body = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const read = (async () => {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                bytes += chunk.value.byteLength;
                if (bytes > 1024) throw new Error('Metric body too large');
                body += decoder.decode(chunk.value, { stream: true });
            }
            return JSON.parse(body + decoder.decode()) as unknown;
        })();
        return await Promise.race([read, new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new Error('Metric body deadline')); }, 1000);
        })]);
    } finally { if (timer) clearTimeout(timer); void reader.cancel().catch(() => {}); }
}

export async function runFrontendMetricsHttp(req: Request): Promise<NextResponse> {
    let input: unknown;
    try { input = await readMetricBody(req); }
    catch { return createErrorResponse('validation', 'Invalid metric body', undefined, 400); }
    const result = await saveFrontendMetric(input);
    if (result === 'invalid') return createErrorResponse('validation', 'Invalid client metric', undefined, 400);
    if (result === 'unavailable') return createErrorResponse('service_unavailable', 'Metric storage unavailable', undefined, 503);
    return createSuccessResponse({ recorded: true, source: 'client' });
}
