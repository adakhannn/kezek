import type { NextRequest, NextResponse } from 'next/server';

/** The language cookie the site already uses (src/lib/cookies.ts). */
export const LOCALE_COOKIE_NAME = 'kezek_lang';
const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
const LOCALES = ['ru', 'ky', 'en'] as const;
type Locale = (typeof LOCALES)[number];

/**
 * A page opened with ?lang=ru|ky|en (the mobile app opens the map this way) renders in that
 * language. Only page requests count: API routes take the language from the cookie or the
 * X-Kezek-Locale header.
 */
export function localeFromQuery(req: NextRequest): Locale | null {
    const { pathname, searchParams } = req.nextUrl;
    if (pathname === '/api' || pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return null;
    const value = searchParams.get('lang')?.trim().toLowerCase();
    return (LOCALES as readonly string[]).includes(value ?? '') ? (value as Locale) : null;
}

/** This request renders in the language: its cookie header carries it to the server components. */
export function applyLocaleToRequest(req: NextRequest, locale: Locale): void {
    req.cookies.set(LOCALE_COOKIE_NAME, locale);
}

/** Later pages keep the language: the browser stores it like the language switcher does. */
export function rememberLocale<R extends NextResponse>(response: R, locale: Locale): R {
    response.cookies.set(LOCALE_COOKIE_NAME, locale, { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax' });
    return response;
}
