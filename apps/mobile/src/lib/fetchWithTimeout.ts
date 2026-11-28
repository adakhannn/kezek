import { withLocaleHeader } from '../i18n/locale';

const DEFAULT_FETCH_TIMEOUT_MS = 15000;

export class TimeoutError extends Error {
    constructor(message = 'Request timed out') {
        super(message);
        this.name = 'TimeoutError';
    }
}

export function isTimeoutError(error: unknown): boolean {
    return error instanceof TimeoutError;
}

function isAbortError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

type FetchWithTimeoutOptions = RequestInit & {
    timeoutMs?: number;
};

export async function fetchWithTimeout(
    input: RequestInfo | URL,
    options: FetchWithTimeoutOptions = {},
): Promise<Response> {
    const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, signal, ...requestInit } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const onAbort = () => controller.abort();
    if (signal) {
        if (signal.aborted) {
            clearTimeout(timeoutId);
            throw new TimeoutError();
        }
        signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
        return await fetch(input, {
            ...requestInit,
            // Every caller talks to the web API, which answers in the app language (FE-10).
            headers: withLocaleHeader(requestInit.headers),
            signal: controller.signal,
        });
    } catch (error: unknown) {
        // Hermes has no global DOMException (KEZEK-MOBILE-1): referencing it threw a ReferenceError
        // that replaced the real network error. Detect the abort by name only.
        if (controller.signal.aborted || isAbortError(error)) {
            throw new TimeoutError();
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        if (signal) {
            signal.removeEventListener('abort', onAbort);
        }
    }
}
