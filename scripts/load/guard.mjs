// Target guard for the local load test (R25-28). Every URL the load test touches passes through
// assertLocalTarget() before the first request; there is no flag that turns it off.
//
// Allowed: http(s) on a loopback host name — localhost, 127.0.0.1 or ::1. Everything else is refused,
// with an explicit message for the hosts that would mean production: *.vercel.app (web on Vercel),
// *.supabase.co / *.supabase.in (hosted Supabase), the production project ref and kezek.kg.

export const PRODUCTION_PROJECT_REF = 'beulnmftzbmtbdlgurht';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const FORBIDDEN_SUFFIXES = ['.vercel.app', '.supabase.co', '.supabase.in', '.supabase.com', 'kezek.kg'];

export class LoadTargetError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LoadTargetError';
    }
}

/**
 * Returns the parsed URL when it is a loopback target; throws LoadTargetError otherwise.
 * @param {string} raw
 * @param {string} label what the URL is (for the message), e.g. "web base URL"
 */
export function assertLocalTarget(raw, label = 'target URL') {
    if (typeof raw !== 'string' || raw.trim() === '') {
        throw new LoadTargetError(`Refusing to run: ${label} is empty.`);
    }
    const text = raw.trim();
    if (text.toLowerCase().includes(PRODUCTION_PROJECT_REF)) {
        throw new LoadTargetError(`Refusing to run: ${label} names the production Supabase project.`);
    }
    let url;
    try {
        url = new URL(text);
    } catch {
        throw new LoadTargetError(`Refusing to run: ${label} is not a valid URL: ${text}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new LoadTargetError(`Refusing to run: ${label} must be http(s), got ${url.protocol}`);
    }
    if (url.username || url.password) {
        throw new LoadTargetError(`Refusing to run: ${label} must not carry credentials.`);
    }
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const forbidden = FORBIDDEN_SUFFIXES.find((suffix) => host === suffix.replace(/^\./, '') || host.endsWith(suffix));
    if (forbidden) {
        throw new LoadTargetError(
            `Refusing to run: ${label} ${url.origin} is a hosted/production host (${forbidden}). ` +
            'The load test runs only against a local stack.',
        );
    }
    if (!LOOPBACK_HOSTS.has(host)) {
        throw new LoadTargetError(
            `Refusing to run: ${label} ${url.origin} is not localhost/127.0.0.1/::1. ` +
            'The load test runs only against a local stack.',
        );
    }
    return url;
}

/** Resolves a path against a guarded base and re-checks the result (no host escape via "//host"). */
export function localUrl(base, path) {
    const resolved = new URL(path, base);
    if (resolved.origin !== new URL(base).origin) {
        throw new LoadTargetError(`Refusing to run: ${path} leaves the local origin ${new URL(base).origin}.`);
    }
    return resolved;
}
