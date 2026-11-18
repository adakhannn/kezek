import { ApiError, createApiClient, DEFAULT_API_TIMEOUT_MS } from '@shared-client/api';

// A fetch that never answers but honours its abort signal, like a dead mobile connection.
function hangingFetch() {
    return jest.fn((_url: string, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    }));
}

describe('API client timeout (MOB-03)', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
        jest.useRealTimers();
    });

    test('a request without an answer fails with a timeout error instead of waiting forever', async () => {
        jest.useFakeTimers();
        global.fetch = hangingFetch() as unknown as typeof fetch;
        const onError = jest.fn();
        const { apiRequest } = createApiClient({ baseUrl: 'https://api.test', onError });

        const pending = apiRequest('/api/slow');
        const assertion = expect(pending).rejects.toMatchObject({
            name: 'ApiError',
            details: { code: 'timeout', timeoutMs: DEFAULT_API_TIMEOUT_MS },
        });
        await jest.advanceTimersByTimeAsync(DEFAULT_API_TIMEOUT_MS);
        await assertion;
        expect(onError).toHaveBeenCalledWith(expect.any(ApiError));
    });

    test('the timeout covers the whole default server deadline', () => {
        expect(DEFAULT_API_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
    });

    test('a per-request timeout overrides the client default', async () => {
        jest.useFakeTimers();
        global.fetch = hangingFetch() as unknown as typeof fetch;
        const { apiRequest } = createApiClient({ baseUrl: 'https://api.test', timeoutMs: 60_000 });

        const pending = apiRequest('/api/slow', { timeoutMs: 1_000 });
        const assertion = expect(pending).rejects.toMatchObject({ details: { code: 'timeout', timeoutMs: 1_000 } });
        await jest.advanceTimersByTimeAsync(1_000);
        await assertion;
    });

    test('the caller can still cancel, and that is not reported as a timeout', async () => {
        global.fetch = hangingFetch() as unknown as typeof fetch;
        const { apiRequest } = createApiClient({ baseUrl: 'https://api.test' });
        const controller = new AbortController();

        const pending = apiRequest('/api/slow', { signal: controller.signal });
        controller.abort();

        await expect(pending).rejects.toBeInstanceOf(ApiError);
        await expect(pending).rejects.not.toMatchObject({ details: { code: 'timeout' } });
    });

    test('a normal answer clears the timer and returns the body', async () => {
        jest.useFakeTimers();
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as unknown as typeof fetch;
        const { apiRequest } = createApiClient({ baseUrl: 'https://api.test' });

        await expect(apiRequest('/api/fast')).resolves.toEqual({ ok: true });
        expect(jest.getTimerCount()).toBe(0);
    });
});
