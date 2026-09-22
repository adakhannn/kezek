type OriginEnv = Record<string, string | undefined>;

/** Public HTTPS origin for local OAuth callbacks reached through a reverse proxy. */
export function getLocalAuthPublicOrigin(requestUrl: string, env: OriginEnv = process.env): string {
    const requestOrigin = new URL(requestUrl).origin;
    if (env.NODE_ENV === 'production') return requestOrigin;

    const configuredOrigin = (env.LOCAL_AUTH_PUBLIC_ORIGIN || env.YANDEX_OAUTH_PUBLIC_ORIGIN)?.trim();
    if (!configuredOrigin) return requestOrigin;

    try {
        const url = new URL(configuredOrigin);
        if (
            url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            url.pathname === '/' &&
            !url.search &&
            !url.hash
        ) {
            return url.origin;
        }
    } catch {
        // Fall back to the request origin if the local override is malformed.
    }

    return requestOrigin;
}
