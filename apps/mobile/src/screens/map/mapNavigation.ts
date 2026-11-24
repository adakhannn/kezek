export const MOBILE_MAP_PATH = '/map';

/** The site's map in the app's language: the site keeps ?lang= as its language cookie. */
export function buildMobileMapUrl(apiUrl: string, locale: 'ru' | 'ky' | 'en' = 'ru'): string {
    return `${apiUrl.replace(/\/+$/, '')}${MOBILE_MAP_PATH}?mobile=1&lang=${locale}`;
}

export function getBookingSlugFromMapUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        const match = parsed.pathname.match(/^\/(?:[a-z]{2}\/)?b\/([^/]+)\/booking\/?$/i);
        return match?.[1] ? decodeURIComponent(match[1]) : null;
    } catch {
        return null;
    }
}

export function isSameOriginMapUrl(url: string, mapUrl: string): boolean {
    try {
        const parsed = new URL(url);
        const map = new URL(mapUrl);

        return parsed.origin === map.origin && parsed.pathname === MOBILE_MAP_PATH;
    } catch {
        return false;
    }
}
