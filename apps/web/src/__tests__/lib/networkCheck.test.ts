import { FAST_FAILURE_MS, PROBE_TIMEOUT_MS, summarizeNetworkCheck, type ProbeResult } from '@/lib/networkCheck/decision';
import { probeSupabase, supabaseProbeUrls, timedFetch } from '@/lib/networkCheck/probes';

const ok: ProbeResult = { kind: 'ok', status: 200, ms: 120 };
const http401: ProbeResult = { kind: 'http', status: 401, ms: 300 };
const fast: ProbeResult = { kind: 'network', ms: 180 };
const slowNetwork: ProbeResult = { kind: 'network', ms: FAST_FAILURE_MS + 500 };
const timeout: ProbeResult = { kind: 'timeout', ms: PROBE_TIMEOUT_MS };

describe('summarizeNetworkCheck', () => {
    test('our own site unreachable: nothing can be said', () => {
        expect(summarizeNetworkCheck({ site: timeout, rest: ok, auth: ok })).toBe('undetermined');
        expect(summarizeNetworkCheck({ site: fast, rest: fast, auth: fast })).toBe('undetermined');
    });
    test('any HTTP answer from Supabase, even 401, means reachable', () => {
        expect(summarizeNetworkCheck({ site: ok, rest: http401, auth: timeout })).toBe('reachable');
        expect(summarizeNetworkCheck({ site: ok, rest: fast, auth: ok })).toBe('reachable');
        expect(summarizeNetworkCheck({ site: ok, rest: { kind: 'opaque', ms: 400 }, auth: fast })).toBe('reachable');
    });
    test('both Supabase probes refused fast: by name (DNS)', () => {
        expect(summarizeNetworkCheck({ site: ok, rest: fast, auth: { kind: 'network', ms: FAST_FAILURE_MS - 1 } }))
            .toBe('blockedDns');
    });
    test('both Supabase probes timed out: by address (IP)', () => {
        expect(summarizeNetworkCheck({ site: ok, rest: timeout, auth: timeout })).toBe('blockedIp');
    });
    test('mixed or slow failures and skipped probes stay undetermined', () => {
        expect(summarizeNetworkCheck({ site: ok, rest: fast, auth: timeout })).toBe('undetermined');
        expect(summarizeNetworkCheck({ site: ok, rest: slowNetwork, auth: slowNetwork })).toBe('undetermined');
        expect(summarizeNetworkCheck({ site: ok, rest: { kind: 'skipped', ms: 0 }, auth: ok })).toBe('undetermined');
    });
});

describe('probes', () => {
    const fetchMock = jest.fn();
    beforeEach(() => { fetchMock.mockReset(); global.fetch = fetchMock; });

    test('timedFetch reports HTTP status, network errors and timeouts', async () => {
        fetchMock.mockResolvedValueOnce({ type: 'cors', ok: false, status: 404 });
        expect(await timedFetch('https://x.test/')).toMatchObject({ kind: 'http', status: 404 });
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        expect(await timedFetch('https://x.test/')).toMatchObject({ kind: 'network' });
        fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }));
        expect(await timedFetch('https://x.test/', {}, 20)).toMatchObject({ kind: 'timeout' });
    });

    test('Supabase probe sends the anon key, and a CORS-only failure counts as reachable (opaque)', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        fetchMock.mockResolvedValueOnce({ type: 'opaque', ok: false, status: 0 });
        const result = await probeSupabase('https://test.supabase.co/auth/v1/health', 'anon');
        expect(result.kind).toBe('opaque');
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { apikey: 'anon' } });
        expect(fetchMock.mock.calls[1][1]).toMatchObject({ mode: 'no-cors' });
        expect(fetchMock.mock.calls[1][1].headers).toBeUndefined();
    });

    test('Supabase probe keeps the network error when the no-cors retry fails too', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
        expect((await probeSupabase('https://test.supabase.co/rest/v1/', 'anon')).kind).toBe('network');
        expect(await probeSupabase(null, 'anon')).toEqual({ kind: 'skipped', ms: 0 });
    });

    test('probe URLs come from the public Supabase URL', () => {
        expect(supabaseProbeUrls('https://abc.supabase.co/')).toEqual({ rest: 'https://abc.supabase.co/rest/v1/',
            auth: 'https://abc.supabase.co/auth/v1/health', host: 'abc.supabase.co' });
        expect(supabaseProbeUrls(undefined)).toBeNull();
        expect(supabaseProbeUrls('not a url')).toBeNull();
    });
});
