/** @jest-environment jsdom */
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { AuthStatusUpdater } from '@/app/_components/AuthStatusWrapper';
import { LanguageProvider, useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { resetPreferredLocaleSyncForTests } from '@/lib/preferredLocaleSync';

// FE-10: the site language becomes the signed-in user's notification language.
let authCallback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined;
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/lib/supabaseClient', () => ({
    supabase: { auth: { onAuthStateChange: (callback: typeof authCallback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
    } } },
}));

function Switcher() {
    const { setLocale } = useLanguage();
    return <>{(['ru', 'en', 'ky'] as const).map(next => <button key={next} onClick={() => setLocale(next)}>{next}</button>)}</>;
}

const fetchMock = jest.fn();
const originalFetch = global.fetch;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const sentLocales = () => fetchMock.mock.calls.map(([url, init]: [string, RequestInit]) => {
    expect(url).toBe('/api/profile/locale');
    expect(init.method).toBe('POST');
    return JSON.parse(String(init.body)).locale;
});
const signIn = (event: AuthChangeEvent, userId: string | null) =>
    act(() => { authCallback?.(event, userId ? { user: { id: userId } } as Session : null); });

beforeEach(() => {
    resetPreferredLocaleSyncForTests();
    window.localStorage.clear();
    document.cookie = 'kezek_lang=ky; path=/';
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; });

function renderApp() {
    render(<LanguageProvider initialLocale="ky"><AuthStatusUpdater /><Switcher /></LanguageProvider>);
}

it('a signed-in user\'s language is saved on load once, and again on each change', async () => {
    renderApp();
    signIn('INITIAL_SESSION', 'user-1');
    await flush();
    expect(sentLocales()).toEqual(['ky']);

    fireEvent.click(screen.getByText('en'));
    await flush();
    expect(sentLocales()).toEqual(['ky', 'en']);
    expect(window.localStorage.getItem('kezek_locale_saved')).toBe('user-1:en');
});

it('a language already saved for this user is not sent again on the next load', async () => {
    window.localStorage.setItem('kezek_locale_saved', 'user-1:ky');
    renderApp();
    signIn('INITIAL_SESSION', 'user-1');
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
});

it('signed out: nothing is sent; after sign-in the current language is saved', async () => {
    renderApp();
    signIn('INITIAL_SESSION', null);
    fireEvent.click(screen.getByText('ru'));
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();

    signIn('SIGNED_IN', 'user-2');
    await flush();
    expect(sentLocales()).toEqual(['ru']);
});

it('a 401 or a network error changes nothing in the page and is tried again later', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 }).mockRejectedValueOnce(new Error('offline'));
    renderApp();
    fireEvent.click(screen.getByText('en'));
    await flush();
    signIn('INITIAL_SESSION', 'user-3');
    await flush();
    expect(sentLocales()).toEqual(['en', 'en']);
    expect(window.localStorage.getItem('kezek_locale_saved')).toBeNull();
    expect(document.cookie).toContain('kezek_lang=en');
});
