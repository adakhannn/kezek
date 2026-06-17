import { getRawErrorMessage, isNetworkError } from './errors';

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429]);

function getErrorStatus(error: unknown): number | undefined {
    if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status?: unknown }).status;
        if (typeof status === 'number') return status;
    }

    const match = getRawErrorMessage(error).match(/\b(?:HTTP\s*)?([45]\d{2})\b/i);
    return match ? Number(match[1]) : undefined;
}

export function isTransientQueryError(error: unknown): boolean {
    if (isNetworkError(error)) return true;

    if (/timeout|timed out|temporarily unavailable/i.test(getRawErrorMessage(error))) {
        return true;
    }

    const status = getErrorStatus(error);
    return status !== undefined && (TRANSIENT_HTTP_STATUSES.has(status) || status >= 500);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
    return failureCount < 2 && isTransientQueryError(error);
}
