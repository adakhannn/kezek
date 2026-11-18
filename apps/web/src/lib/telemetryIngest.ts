import 'server-only';

import { z } from 'zod';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';

/**
 * Shared rules for the public analytics beacons (/api/funnel-events, /admin/api/analytics/track;
 * API-09): a bounded JSON body, bounded identifiers and metadata, and failures that never echo
 * database text.
 */
export const TELEMETRY_MAX_BYTES = 4096;

type ReadResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 | 415 };

/**
 * Reads at most maxBytes of an application/json body within one second. Only JSON is accepted,
 * which also forces a CORS preflight for cross-site pages (a text/plain POST is a simple request).
 */
export async function readTelemetryJson(req: Request, maxBytes = TELEMETRY_MAX_BYTES): Promise<ReadResult> {
    if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) return { ok: false, status: 415 };
    const declared = Number(req.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };

    const reader = req.body?.getReader();
    if (!reader) return { ok: false, status: 400 };
    const decoder = new TextDecoder();
    let bytes = 0;
    let body = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const read = (async (): Promise<ReadResult> => {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                bytes += chunk.value.byteLength;
                if (bytes > maxBytes) return { ok: false, status: 413 };
                body += decoder.decode(chunk.value, { stream: true });
            }
            try {
                return { ok: true, value: JSON.parse(body + decoder.decode()) as unknown };
            } catch {
                return { ok: false, status: 400 };
            }
        })();
        return await Promise.race([read, new Promise<ReadResult>((resolve) => {
            timer = setTimeout(() => {
                void reader.cancel().catch(() => {});
                resolve({ ok: false, status: 400 });
            }, 1000);
        })]);
    } finally {
        if (timer) clearTimeout(timer);
        void reader.cancel().catch(() => {});
    }
}

export function telemetryReadFailure(status: 400 | 413 | 415) {
    const message = status === 415 ? 'Expected application/json' : status === 413 ? 'Event too large' : 'Invalid JSON body';
    return createErrorResponse('validation', message, undefined, status);
}

/** Web session_<ms>_<rand>, crypto.randomUUID() and mobile m_<ms>_<rand>. */
export const telemetrySessionId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Flat metadata: at most 20 short keys with short scalar values. */
export const telemetryMetadata = z
    .record(z.string().regex(/^[A-Za-z0-9_.-]{1,40}$/), z.union([z.string().max(200), z.number().finite(), z.boolean(), z.null()]))
    .refine((value) => Object.keys(value).length <= 20, { message: 'At most 20 metadata keys' });

const REJECTED_CODES = new Set(['23503', '23514', '23502', '22P02', '22007', '22008', '22001']);

/** A refused row is the caller's fault (400); anything else is ours (500). The DB text stays in the log. */
export function telemetryWriteFailure(scope: string, error: { code?: string; message?: string }) {
    logError(scope, 'Event not recorded', { code: error.code, message: error.message });
    return REJECTED_CODES.has(error.code ?? '')
        ? createErrorResponse('validation', 'Event rejected', undefined, 400)
        : createErrorResponse('internal', 'Event not recorded', undefined, 500);
}
