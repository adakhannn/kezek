/**
 * Browser probes of the network check page. Each probe measures one fetch with a deadline and never
 * throws; nothing is sent anywhere except the probed URL itself, and nothing is stored.
 */
import { PROBE_TIMEOUT_MS, type ProbeResult } from './decision';

/**
 * A neutral Cloudflare-served control. Cloudflare's own edge answers on other anycast ranges than the
 * addresses seen for the Supabase host (8.6.112.0/24, 8.47.69.0/24 in R25-31). With Supabase failing:
 * control reachable → only Supabase's name/addresses are blocked (a Cloudflare Worker, option B2, may
 * work); control failing too → Cloudflare is cut off broadly and only a non-Cloudflare proxy (Vercel,
 * B1) helps. It sends no CORS headers, so it is fetched with `mode: 'no-cors'` and only timed: an
 * opaque answer still proves that DNS, TCP and TLS to it worked. Must stay in the CSP connect-src.
 */
export const CLOUDFLARE_CONTROL_URL = 'https://www.cloudflare.com/cdn-cgi/trace';

/** Same-origin baseline: a static icon served by the CDN, outside the middleware and Supabase. */
export const SITE_PROBE_PATH = '/icon-192.png';

export const DNS_ENDPOINT_PATH = '/api/network-check/dns';

type Clock = () => number;
const defaultClock: Clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export async function timedFetch(
    url: string,
    init: RequestInit = {},
    timeoutMs: number = PROBE_TIMEOUT_MS,
    now: Clock = defaultClock,
): Promise<ProbeResult & { response?: Response }> {
    const controller = new AbortController();
    const started = now();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { cache: 'no-store', credentials: 'omit', ...init, signal: controller.signal });
        const ms = Math.round(now() - started);
        if (response.type === 'opaque') return { kind: 'opaque', ms, response };
        return { kind: response.ok ? 'ok' : 'http', status: response.status, ms, response };
    } catch {
        const ms = Math.round(now() - started);
        return { kind: controller.signal.aborted ? 'timeout' : 'network', ms };
    } finally {
        clearTimeout(timer);
    }
}

function strip({ kind, status, ms }: ProbeResult & { response?: Response }): ProbeResult {
    return status === undefined ? { kind, ms } : { kind, status, ms };
}

/**
 * A Supabase endpoint with the public anon key (the key needs a CORS preflight). If the CORS request
 * fails fast, the same URL is retried with `no-cors` and no headers: an opaque answer means the host is
 * reachable and only CORS failed, which must not be read as a block.
 */
export async function probeSupabase(url: string | null, anonKey: string | null, now: Clock = defaultClock): Promise<ProbeResult> {
    if (!url || !anonKey) return { kind: 'skipped', ms: 0 };
    const first = strip(await timedFetch(url, { headers: { apikey: anonKey } }, PROBE_TIMEOUT_MS, now));
    if (first.kind !== 'network') return first;
    const left = PROBE_TIMEOUT_MS - first.ms;
    if (left < 500) return first;
    const retry = strip(await timedFetch(url, { mode: 'no-cors' }, left, now));
    return retry.kind === 'opaque' ? { kind: 'opaque', ms: first.ms + retry.ms } : first;
}

export async function probeSite(now: Clock = defaultClock): Promise<ProbeResult> {
    return strip(await timedFetch(`${SITE_PROBE_PATH}?nc=${Date.now()}`, { method: 'HEAD' }, PROBE_TIMEOUT_MS, now));
}

export async function probeControl(now: Clock = defaultClock): Promise<ProbeResult> {
    return strip(await timedFetch(CLOUDFLARE_CONTROL_URL, { mode: 'no-cors' }, PROBE_TIMEOUT_MS, now));
}

export type ServerDnsData = { host: string; ipv4: string[]; ipv6: string[]; ms: number };

/** The server-side DNS answer for the Supabase host, as seen from Vercel (not from this network). */
export async function probeServerDns(now: Clock = defaultClock): Promise<{ result: ProbeResult; data: ServerDnsData | null }> {
    const result = await timedFetch(DNS_ENDPOINT_PATH, {}, PROBE_TIMEOUT_MS, now);
    let data: ServerDnsData | null = null;
    if (result.response && result.kind === 'ok') {
        try {
            const body = (await result.response.json()) as { ok?: boolean; data?: ServerDnsData };
            if (body?.ok && body.data && Array.isArray(body.data.ipv4) && Array.isArray(body.data.ipv6)) data = body.data;
        } catch {
            data = null;
        }
    }
    return { result: strip(result), data };
}

export function supabaseProbeUrls(baseUrl: string | undefined): { rest: string; auth: string; host: string } | null {
    if (!baseUrl) return null;
    try {
        const url = new URL(baseUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        const origin = url.origin;
        return { rest: `${origin}/rest/v1/`, auth: `${origin}/auth/v1/health`, host: url.host };
    } catch {
        return null;
    }
}
