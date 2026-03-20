export type AuthCallbackParams = {
    accessToken: string | null;
    refreshToken: string | null;
    code: string | null;
    exchangeCode: string | null;
};

export function isAuthCallbackUrl(url: string): boolean {
    return (
        url.includes('auth/callback') ||
        url.includes('callback-mobile') ||
        url.includes('#access_token=') ||
        url.includes('?code=') ||
        url.includes('access_token=') ||
        url.includes('refresh_token=')
    );
}

export function extractAuthCallbackParams(url: string): AuthCallbackParams {
    try {
        const urlObj = new URL(url);
        const hashParams = new URLSearchParams(urlObj.hash.substring(1));
        const queryParams = new URLSearchParams(urlObj.search);

        return {
            accessToken: hashParams.get('access_token') || queryParams.get('access_token'),
            refreshToken: hashParams.get('refresh_token') || queryParams.get('refresh_token'),
            code: queryParams.get('code'),
            exchangeCode: queryParams.get('exchange_code'),
        };
    } catch {
        const hashMatch = url.match(/#access_token=([^&]+)&refresh_token=([^&]+)/);
        if (hashMatch) {
            return {
                accessToken: decodeURIComponent(hashMatch[1]),
                refreshToken: decodeURIComponent(hashMatch[2]),
                code: null,
                exchangeCode: null,
            };
        }

        return {
            accessToken: null,
            refreshToken: null,
            code: null,
            exchangeCode: null,
        };
    }
}

export function resolveMobileApiUrl(args?: {
    envApiUrl?: string;
    expoConfigApiUrl?: string;
    manifestApiUrl?: string;
    fallback?: string;
}): string {
    return (
        args?.envApiUrl ||
        args?.expoConfigApiUrl ||
        args?.manifestApiUrl ||
        args?.fallback ||
        'https://kezek.kg'
    );
}

export function buildMobileExchangeUrl(apiUrl: string, code: string): string {
    return `${apiUrl}/api/auth/mobile-exchange?code=${encodeURIComponent(code)}`;
}

export function buildMobilePendingCheckUrl(apiUrl: string): string {
    return `${apiUrl}/api/auth/mobile-exchange?check=true`;
}
