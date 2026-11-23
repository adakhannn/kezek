/**
 * Every web API request carries X-Kezek-Locale, so the API answers in the app language (FE-10).
 */
import { getRequestLocale, setRequestLocale, withLocaleHeader } from '../../i18n/locale';
import { apiRequest } from '../../lib/api';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout';
import { supabase } from '../../lib/supabase';

const mockedFetch = global.fetch as jest.Mock;
const mockedAuth = supabase.auth as unknown as { getSession: jest.Mock };

function sentHeaders(): Record<string, string> {
    const init = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1][1] as RequestInit;
    return init.headers as Record<string, string>;
}

describe('X-Kezek-Locale request header', () => {
    beforeEach(() => {
        mockedFetch.mockReset();
        mockedFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
        mockedAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'token-1' } }, error: null });
    });

    afterAll(() => {
        setRequestLocale('ru');
    });

    test('withLocaleHeader adds the current language and keeps the other headers', () => {
        setRequestLocale('ky');
        expect(getRequestLocale()).toBe('ky');
        expect(withLocaleHeader({ 'Content-Type': 'application/json' })).toEqual({
            'Content-Type': 'application/json',
            'X-Kezek-Locale': 'ky',
        });
        expect(withLocaleHeader(new Headers({ 'x-trace': '1' }))).toEqual({ 'x-trace': '1', 'X-Kezek-Locale': 'ky' });
        expect(withLocaleHeader([['a', 'b']])).toEqual({ a: 'b', 'X-Kezek-Locale': 'ky' });
        expect(withLocaleHeader({ 'x-kezek-locale': 'en' })).toEqual({ 'x-kezek-locale': 'en' });
        expect(withLocaleHeader()).toEqual({ 'X-Kezek-Locale': 'ky' });
    });

    test('apiRequest sends the language next to the Bearer token', async () => {
        setRequestLocale('en');
        await apiRequest('/profile/locale', { method: 'POST', headers: { 'x-extra': '1' }, body: '{}' });

        expect(mockedFetch.mock.calls[0][0]).toBe('https://kezek.vercel.app/api/profile/locale');
        expect(sentHeaders()).toMatchObject({
            'X-Kezek-Locale': 'en',
            'x-extra': '1',
            Authorization: 'Bearer token-1',
        });
    });

    test('fetchWithTimeout sends the language with the sign-in requests', async () => {
        setRequestLocale('ky');
        await fetchWithTimeout('https://kezek.vercel.app/api/auth/whatsapp/mobile/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        expect(sentHeaders()).toEqual({ 'Content-Type': 'application/json', 'X-Kezek-Locale': 'ky' });

        setRequestLocale('ru');
        await fetchWithTimeout('https://kezek.vercel.app/api/auth/telegram/mobile/status?nonce=n');
        expect(sentHeaders()).toEqual({ 'X-Kezek-Locale': 'ru' });
    });
});
