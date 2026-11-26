import { TimeoutError } from './fetchWithTimeout';

/**
 * Upper bound for one request of the Supabase client (auth, PostgREST, storage). Without it a request
 * to an unreachable Supabase never settles: WhatsApp sign-in stayed on «Проверка…» forever after the
 * code was accepted (R25-30). Long enough for a slow mobile network.
 */
export const SUPABASE_REQUEST_TIMEOUT_MS = 20_000;

/**
 * `fetch` for createClient({ global: { fetch } }): aborts after `timeoutMs` with TimeoutError, which
 * the screens already map to the localized "check your connection" message. An abort by the caller
 * (supabase-js cancelling its own request) stays an AbortError.
 */
export function createSupabaseFetch(timeoutMs = SUPABASE_REQUEST_TIMEOUT_MS, baseFetch: typeof fetch = fetch): typeof fetch {
    return async (input, init = {}) => {
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);
        const callerSignal = init.signal;
        const onCallerAbort = () => controller.abort();
        if (callerSignal) {
            if (callerSignal.aborted) controller.abort();
            else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
        }
        try {
            return await baseFetch(input, { ...init, signal: controller.signal });
        } catch (error) {
            if (timedOut) throw new TimeoutError('Supabase request timed out');
            throw error;
        } finally {
            clearTimeout(timer);
            callerSignal?.removeEventListener('abort', onCallerAbort);
        }
    };
}
