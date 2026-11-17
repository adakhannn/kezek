/**
 * Hands a server-issued session to the browser: /auth/callback reads the
 * fragment, calls setSession and leaves with location.replace, so the tokens do
 * not stay in history and never reach a server (fragments are not sent).
 */
export function buildSessionCallbackUrl({
    origin,
    next,
    accessToken,
    refreshToken,
}: {
    origin: string;
    next: string;
    accessToken: string;
    refreshToken: string;
}): string {
    const url = new URL('/auth/callback', origin);
    url.searchParams.set('next', next);
    url.hash = `access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
    return url.toString();
}
