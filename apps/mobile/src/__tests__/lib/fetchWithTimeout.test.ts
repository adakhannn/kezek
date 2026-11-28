/**
 * KEZEK-MOBILE-1: Hermes has no global DOMException. A network failure must reach the caller
 * as itself (TypeError), not as "Property 'DOMException' doesn't exist".
 */
import { fetchWithTimeout, isTimeoutError, TimeoutError } from '../../lib/fetchWithTimeout';

const mockedFetch = global.fetch as jest.Mock;

describe('fetchWithTimeout without a global DOMException (Hermes)', () => {
    const globals = globalThis as { DOMException?: unknown };
    const originalDOMException = globals.DOMException;

    beforeEach(() => {
        mockedFetch.mockReset();
        delete globals.DOMException;
    });

    afterEach(() => {
        if (originalDOMException !== undefined) globals.DOMException = originalDOMException;
    });

    test('rethrows the original network error', async () => {
        const networkError = new TypeError('Network request failed');
        mockedFetch.mockRejectedValue(networkError);

        await expect(fetchWithTimeout('https://example.test/api')).rejects.toBe(networkError);
        expect(typeof globals.DOMException).toBe('undefined');
    });

    test('an AbortError from fetch becomes a TimeoutError', async () => {
        mockedFetch.mockRejectedValue({ name: 'AbortError', message: 'Aborted' });

        const error = await fetchWithTimeout('https://example.test/api').catch((e: unknown) => e);
        expect(error).toBeInstanceOf(TimeoutError);
        expect(isTimeoutError(error)).toBe(true);
    });

    test('our own timeout becomes a TimeoutError', async () => {
        mockedFetch.mockImplementation(
            (_input: unknown, init: RequestInit) =>
                new Promise((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
                }),
        );

        await expect(fetchWithTimeout('https://example.test/api', { timeoutMs: 5 })).rejects.toBeInstanceOf(
            TimeoutError,
        );
    });
});
