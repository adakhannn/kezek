/**
 * Network check (R25-31, step 0 of docs/SUPABASE_ACCESS_OPTIONS.md): result types and the summary rule.
 * Pure module — no browser or server APIs — so the rule is unit-tested on its own.
 */

/**
 * - ok: HTTP 2xx; http: any other HTTP status (still proves the host answered);
 * - opaque: a `no-cors` request resolved — the host answered, but the browser hides status and body;
 * - timeout: no answer before the deadline (typical of dropped packets, i.e. an IP block);
 * - network: fetch rejected with a TypeError (name not resolved, connection reset/refused, TLS failure,
 *   or CORS); a fast rejection is typical of a DNS or name-based (SNI) block;
 * - skipped: the probe could not be run here (e.g. no public Supabase URL in this build).
 */
export type ProbeKind = 'ok' | 'http' | 'opaque' | 'timeout' | 'network' | 'skipped';

export type ProbeResult = {
    kind: ProbeKind;
    /** HTTP status for ok/http. */
    status?: number;
    /** Time from the start of the probe to its answer or failure, ms. */
    ms: number;
};

export type NetworkVerdict = 'reachable' | 'blockedDns' | 'blockedIp' | 'undetermined';

/** A probe deadline (ms). Mobile networks in the field are slow, but a drop never answers at all. */
export const PROBE_TIMEOUT_MS = 8000;

/**
 * A TypeError faster than this is a refusal (no address, reset), not a silent drop. Android's stub
 * resolver gives up on an unanswered query after about 5 s, so a DNS block that drops queries rather
 * than answering NXDOMAIN lands between this and the timeout and stays «undetermined» on purpose.
 */
export const FAST_FAILURE_MS = 2500;

export function isReachable(result: ProbeResult): boolean {
    return result.kind === 'ok' || result.kind === 'http' || result.kind === 'opaque';
}

/**
 * The summary rule, from the browser probes only (a browser cannot resolve DNS itself):
 * 1. Our own site did not answer → «undetermined»: the device is offline or the whole network is down,
 *    so nothing can be said about Supabase.
 * 2. Either Supabase probe (REST or Auth) got any HTTP answer, even 401/404 → «reachable».
 * 3. Both Supabase probes failed with a fast network error (< FAST_FAILURE_MS) → «blockedDns»: the name
 *    was refused (no/false address from DNS, or a reset on the TLS server name). A custom Supabase
 *    domain (option A) would help.
 * 4. Both Supabase probes timed out → «blockedIp»: packets to the addresses are dropped; only a proxy
 *    off those addresses (Vercel, option B1) helps.
 * 5. Anything else (mixed, slow network errors, a probe skipped) → «undetermined».
 * The Cloudflare control and the server-side DNS answer are shown next to it but do not change it:
 * they tell which fix fits once the type is known (see the page and the API contract).
 */
export function summarizeNetworkCheck(input: {
    site: ProbeResult;
    rest: ProbeResult;
    auth: ProbeResult;
}): NetworkVerdict {
    const { site, rest, auth } = input;
    if (!isReachable(site)) return 'undetermined';
    if (rest.kind === 'skipped' || auth.kind === 'skipped') return 'undetermined';
    if (isReachable(rest) || isReachable(auth)) return 'reachable';
    const failures = [rest, auth];
    if (failures.every((f) => f.kind === 'network' && f.ms < FAST_FAILURE_MS)) return 'blockedDns';
    if (failures.every((f) => f.kind === 'timeout')) return 'blockedIp';
    return 'undetermined';
}
