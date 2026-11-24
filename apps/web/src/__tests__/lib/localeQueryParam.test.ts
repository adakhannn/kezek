import { NextRequest, NextResponse } from 'next/server';

import { LOCALE_COOKIE_NAME, applyLocaleToRequest, localeFromQuery, rememberLocale } from '@/lib/localeQueryParam';

// The mobile app opens the map as /map?mobile=1&lang=ky: the page and the next ones follow it.
describe('locale from the ?lang= query parameter', () => {
    const request = (url: string, cookie?: string) =>
        new NextRequest(url, cookie ? { headers: { cookie } } : undefined);

    test('a page request with ru, ky or en takes that language; anything else is ignored', () => {
        expect(localeFromQuery(request('https://kezek.test/map?mobile=1&lang=ky'))).toBe('ky');
        expect(localeFromQuery(request('https://kezek.test/b/salon?lang=EN'))).toBe('en');
        expect(localeFromQuery(request('https://kezek.test/?lang=ru'))).toBe('ru');
        // A page whose path merely starts with "api" is still a page.
        expect(localeFromQuery(request('https://kezek.test/api-docs?lang=en'))).toBe('en');
        expect(localeFromQuery(request('https://kezek.test/map?lang=de'))).toBeNull();
        expect(localeFromQuery(request('https://kezek.test/map'))).toBeNull();
    });

    test('API and Next asset requests never take the parameter', () => {
        expect(localeFromQuery(request('https://kezek.test/api/bookings?lang=ky'))).toBeNull();
        expect(localeFromQuery(request('https://kezek.test/_next/static/chunks/app.js?lang=ky'))).toBeNull();
    });

    test('this render sees the language, replacing an older cookie, and the browser keeps it', () => {
        const req = request('https://kezek.test/map?lang=ky', `${LOCALE_COOKIE_NAME}=ru; other=1`);
        applyLocaleToRequest(req, 'ky');
        expect(req.cookies.get(LOCALE_COOKIE_NAME)?.value).toBe('ky');
        expect(req.cookies.get('other')?.value).toBe('1');
        expect(req.headers.get('cookie')).toContain(`${LOCALE_COOKIE_NAME}=ky`);

        const response = rememberLocale(NextResponse.next(), 'ky');
        const setCookie = response.headers.get('set-cookie') ?? '';
        expect(setCookie).toContain(`${LOCALE_COOKIE_NAME}=ky`);
        expect(setCookie).toMatch(/Path=\//i);
        expect(setCookie).toMatch(/SameSite=lax/i);
        // The client language switcher reads the cookie, so it must not be HttpOnly.
        expect(setCookie).not.toMatch(/HttpOnly/i);
    });
});
