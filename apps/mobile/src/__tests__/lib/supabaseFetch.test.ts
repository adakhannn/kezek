import { isTimeoutError } from '../../lib/fetchWithTimeout';
import { createSupabaseFetch } from '../../lib/supabaseFetch';

function hangingFetch(): typeof fetch {
    return ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
                const error = new Error('Aborted');
                error.name = 'AbortError';
                reject(error);
            });
        })) as typeof fetch;
}

describe('createSupabaseFetch (R25-30)', () => {
    afterEach(() => jest.useRealTimers());

    test('a request that never answers fails with TimeoutError after the bound', async () => {
        jest.useFakeTimers();
        const pending = createSupabaseFetch(20_000, hangingFetch())('https://example.supabase.co/auth/v1/user');
        const outcome = pending.then(() => 'resolved', (error: unknown) => error);
        jest.advanceTimersByTime(20_000);
        expect(isTimeoutError(await outcome)).toBe(true);
    });

    test('an abort by the caller stays an AbortError', async () => {
        const controller = new AbortController();
        const pending = createSupabaseFetch(20_000, hangingFetch())('https://example.supabase.co/rest/v1/x', { signal: controller.signal });
        controller.abort();
        await pending.then(
            () => { throw new Error('resolved'); },
            (error: Error) => {
                expect(isTimeoutError(error)).toBe(false);
                expect(error.name).toBe('AbortError');
            },
        );
    });

    test('a normal answer passes through and clears the timer', async () => {
        jest.useFakeTimers();
        const response = { ok: true } as Response;
        const fetchImpl = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;
        await expect(createSupabaseFetch(1_000, fetchImpl)('https://example.supabase.co')).resolves.toBe(response);
        expect(jest.getTimerCount()).toBe(0);
    });
});
