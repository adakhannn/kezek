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
            signal: controller.signal,
        });
    } catch (error: unknown) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
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

export const AUTH_TIMEOUT_MESSAGE = 'Превышено время ожидания. Проверьте интернет и попробуйте снова.';
