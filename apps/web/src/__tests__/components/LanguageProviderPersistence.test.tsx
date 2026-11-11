/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { LanguageProvider, useLanguage } from '@/app/_components/i18n/LanguageProvider';
import ProfileForm from '@/app/cabinet/components/ProfileForm';
import { supabase } from '@/lib/supabaseClient';

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { getUser: jest.fn() }, from: jest.fn() } }));
jest.mock('@/app/cabinet/components/AccountDeletionPanel', () => ({ AccountDeletionPanel: () => null }));
jest.mock('@/app/cabinet/components/TelegramBotLink', () => ({ TelegramBotLink: () => null }));
jest.mock('@/app/cabinet/components/TelegramLinkWidget', () => ({ TelegramLinkWidget: () => null }));
jest.mock('@/app/cabinet/components/ConnectionUnlinkConfirmation', () => ({ ConnectionUnlinkConfirmation: () => null }));

function Probe() {
    const { locale, setLocale, t } = useLanguage();
    return <div>
        <span data-testid="locale">{locale}</span>
        <span data-testid="translation">{t('header.language')}</span>
        {(['ru', 'en', 'ky'] as const).map(next => <button key={next} onClick={() => setLocale(next)}>{next}</button>)}
    </div>;
}
const current = () => screen.getByTestId('locale').textContent;
const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
let originalFetch: typeof fetch;
beforeEach(() => {
    window.localStorage.clear();
    document.cookie = 'kezek_lang=; path=/; max-age=0';
    document.documentElement.lang = 'ru';
    jest.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-US');
    originalFetch = global.fetch;
});
afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Document.prototype, 'cookie', cookieDescriptor);
    global.fetch = originalFetch;
});

it.each([
    { cookie: 'ky', saved: 'en', browser: 'ru-RU', initial: 'ru' as const, expected: 'ky' },
    { cookie: '', saved: 'ky', browser: 'en-US', initial: 'ru' as const, expected: 'ky' },
    { cookie: 'invalid', saved: 'invalid', browser: 'en-US', initial: 'ru' as const, expected: 'en' },
    { cookie: '', saved: '', browser: 'fr-FR', initial: 'ky' as const, expected: 'ky' },
])('resolves cookie, legacy storage, browser, then server fallback: %j', fixture => {
    if (fixture.cookie) document.cookie = `kezek_lang=${fixture.cookie}; path=/`;
    if (fixture.saved) window.localStorage.setItem('kezek_locale', fixture.saved);
    jest.spyOn(window.navigator, 'language', 'get').mockReturnValue(fixture.browser);
    render(<LanguageProvider initialLocale={fixture.initial}><Probe /></LanguageProvider>);
    expect(current()).toBe(fixture.expected);
    expect(document.documentElement.lang).toBe(fixture.expected);
    expect(document.cookie).toContain(`kezek_lang=${fixture.expected}`);
    expect(window.localStorage.getItem('kezek_locale')).toBe(fixture.expected);
});

it('hydrates the server locale before adopting the browser preference without a mismatch', async () => {
    document.cookie = 'kezek_lang=en; path=/';
    const commits: string[] = [];
    function HydrationProbe() {
        const { locale } = useLanguage();
        useLayoutEffect(() => { commits.push(locale); }, [locale]);
        return <p>{locale}</p>;
    }
    const container = document.createElement('div');
    container.innerHTML = '<p>ru</p>';
    document.body.appendChild(container);
    const onRecoverableError = jest.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
        await act(async () => { root = hydrateRoot(container, <LanguageProvider initialLocale="ru"><HydrationProbe /></LanguageProvider>, { onRecoverableError }); });
        expect(commits[0]).toBe('ru');
        expect(commits.at(-1)).toBe('en');
        expect(container.textContent).toBe('en');
        expect(document.cookie).toContain('kezek_lang=en');
        expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
        await act(async () => root?.unmount());
        container.remove();
    }
});

it('keeps the cookie authoritative when legacy storage is blocked', () => {
    document.cookie = 'kezek_lang=ky; path=/';
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(current()).toBe('ky');
    expect(document.documentElement.lang).toBe('ky');
});

it('keeps browser fallback and explicit changes usable when both stores reject access', () => {
    Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        get: () => { throw new Error('blocked cookie'); },
        set: () => { throw new Error('blocked cookie'); },
    });
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked storage'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked storage'); });
    const view = render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(current()).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: 'ky', exact: true }));
    expect(current()).toBe('ky');
    view.rerender(<LanguageProvider><Probe /></LanguageProvider>);
    expect(current()).toBe('ky');
    expect(document.documentElement.lang).toBe('ky');
});

it('updates from another tab and ignores unrelated storage events', () => {
    document.cookie = 'kezek_lang=ru; path=/';
    render(<LanguageProvider><Probe /></LanguageProvider>);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })));
    expect(current()).toBe('ru');
    act(() => {
        document.cookie = 'kezek_lang=en; path=/';
        window.localStorage.setItem('kezek_locale', 'en');
        window.dispatchEvent(new StorageEvent('storage', { key: 'kezek_locale', newValue: 'en' }));
    });
    expect(current()).toBe('en');
    expect(screen.getByTestId('translation').textContent).toBe('Language');
});

it('preserves a real profile draft when the provider changes locale', async () => {
    document.cookie = 'kezek_lang=ru; path=/';
    const profileRead = jest.fn().mockResolvedValue({ data: { full_name: 'UNIT ORIGINAL', phone: null, notify_email: false }, error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'unit-user', identities: [] } }, error: null });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: profileRead }) }) });
    global.fetch = jest.fn(async (url: unknown) => {
        if (url !== '/api/profile/notification-emails') throw new Error('Unexpected request');
        return { ok: true, json: async () => ({ ok: true, data: [] }) };
    }) as jest.Mock;
    render(<LanguageProvider><Probe /><ProfileForm /></LanguageProvider>);
    const name = await screen.findByDisplayValue('UNIT ORIGINAL');
    fireEvent.change(name, { target: { value: 'UNIT DRAFT' } });
    fireEvent.click(screen.getByRole('button', { name: 'en', exact: true }));
    expect(current()).toBe('en');
    expect(screen.getByDisplayValue('UNIT DRAFT')).toBeTruthy();
    expect(profileRead).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
});
