/**
 * Утилиты для работы с cookie
 */

type Locale = 'ky' | 'ru' | 'en';

const COOKIE_NAME = 'kezek_lang';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 год

/**
 * Чтение локали из cookie (client-side)
 */
export function getLocaleFromCookie(): Locale | null {
    if (typeof document === 'undefined') return null;
    
    try {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === COOKIE_NAME && value) {
                const locale = decodeURIComponent(value) as Locale;
                if (['ky', 'ru', 'en'].includes(locale)) {
                    return locale;
                }
            }
        }
    } catch {
        // ignore
    }
    
    return null;
}

/**
 * Запись локали в cookie (client-side)
 */
export function setLocaleInCookie(locale: Locale): void {
    if (typeof document === 'undefined') return;
    
    try {
        const expires = new Date();
        expires.setTime(expires.getTime() + COOKIE_MAX_AGE * 1000);
        
        document.cookie = `${COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    } catch {
        // ignore
    }
}

/**
 * Чтение локали из cookie (server-side)
 * Используется в server components и middleware
 */
export async function getLocaleFromCookieServer(): Promise<Locale | null> {
    try {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        const localeValue = cookieStore.get(COOKIE_NAME)?.value;
        
        if (localeValue) {
            const locale = decodeURIComponent(localeValue) as Locale;
            if (['ky', 'ru', 'en'].includes(locale)) {
                return locale;
            }
        }
    } catch {
        // ignore
    }
    
    return null;
}

/**
 * Установка локали в cookie через middleware или server action
 * Используется в middleware для установки cookie
 */
export function setLocaleCookieHeader(locale: Locale): string {
    return `${COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

