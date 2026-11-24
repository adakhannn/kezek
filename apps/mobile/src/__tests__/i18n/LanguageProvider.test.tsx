/**
 * Mobile i18n: LanguageProvider, t() and the language switcher.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { createTranslate, LanguageProvider, LanguageSwitcher, translate, useLanguage, type MobileI18nKey } from '../../i18n';
import { en } from '../../i18n/dictionaries/en';
import { ky } from '../../i18n/dictionaries/ky';
import { ru } from '../../i18n/dictionaries/ru';
import { getRequestLocale, setRequestLocale } from '../../i18n/locale';
import { loadStoredLocale, LOCALE_STORAGE_KEY, readStoredLocale } from '../../i18n/localeStorage';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));

const mockedApiRequest = apiRequest as jest.Mock;
const mockedAuth = supabase.auth as unknown as { getSession: jest.Mock; onAuthStateChange: jest.Mock };

function Probe() {
    const { locale, t } = useLanguage();
    return (
        <>
            <Text testID="locale">{locale}</Text>
            <Text testID="title">{t('auth.whatsapp.title')}</Text>
            <Text testID="param">{t('auth.whatsapp.resendIn', { seconds: 42 })}</Text>
            <Text testID="t-locale">{t.locale}</Text>
        </>
    );
}

function textOf(testID: string): string {
    const children: unknown = screen.getByTestId(testID).props.children;
    return Array.isArray(children) ? children.join('') : String(children);
}

function renderProvider() {
    return render(
        <LanguageProvider>
            <Probe />
            <LanguageSwitcher />
        </LanguageProvider>,
    );
}

function signedIn(signedInNow: boolean) {
    mockedAuth.getSession.mockResolvedValue({
        data: { session: signedInNow ? { access_token: 'token', user: { id: 'user-1' } } : null },
        error: null,
    });
}

/**
 * Captures the onAuthStateChange callback. `auth('SIGNED_IN')` signs user-1 in, `auth('SIGNED_OUT')`
 * out, and lets the sync run (fake timers).
 */
function captureAuth() {
    let onAuth: (event: string, session: unknown) => void = () => {};
    mockedAuth.onAuthStateChange.mockImplementation((callback) => {
        onAuth = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    return async (event: 'SIGNED_IN' | 'SIGNED_OUT') => {
        const signingIn = event === 'SIGNED_IN';
        signedIn(signingIn);
        await act(async () => {
            onAuth(event, signingIn ? { access_token: 'token', user: { id: 'user-1' } } : null);
            await jest.runAllTimersAsync();
        });
    };
}

async function settle() {
    await act(async () => {
        await jest.runAllTimersAsync();
    });
}

async function press(label: string) {
    fireEvent.press(screen.getByText(label));
    await settle();
}

/** The languages POST /api/profile/locale received, in order. */
function profileLocales(): string[] {
    return mockedApiRequest.mock.calls.map(([, init]) => JSON.parse(init.body).locale);
}

describe('mobile i18n', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setRequestLocale('ru');
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
        (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
        mockedApiRequest.mockResolvedValue({ ok: true });
        mockedAuth.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
        signedIn(false);
    });

    test('the dictionaries have the same keys and {placeholders} in ru, ky and en', () => {
        const names = (text: string) => (text.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort().join();
        for (const dictionary of [ky, en]) {
            expect(Object.keys(dictionary).sort()).toEqual(Object.keys(ru).sort());
            for (const key of Object.keys(ru) as MobileI18nKey[]) {
                expect([key, names(dictionary[key])]).toEqual([key, names(ru[key])]);
            }
        }
    });

    test('t() replaces every {placeholder}, falls back to Russian, then to the fallback and the key', () => {
        expect(translate('ky', 'auth.whatsapp.codeSentTo', { phone: '+996555' })).toBe('Код жөнөтүлдү: +996555');
        expect(translate('en', 'auth.whatsapp.resendIn', 'ignored', { seconds: 5 })).toBe('Resend (5s)');
        expect(translate('ru', 'auth.verify.title')).toBe('Подтверждение');
        const unknown = 'auth.notAKey' as MobileI18nKey;
        expect(translate('ky', unknown, 'Запасной текст')).toBe('Запасной текст');
        expect(translate('en', unknown)).toBe('auth.notAKey');
    });

    test('t() fills the placeholders in one pass: a {placeholder} inside a value stays as it is', () => {
        // The client is listed before the service, so a second pass would replace its name.
        expect(translate('en', 'staff.shiftQuick.reviewLine', {
            client: '{service}',
            service: 'Haircut',
            amount: '800 KGS',
            consumables: '{amount}',
        })).toBe('{service} · Haircut · 800 KGS · consumables {amount}');
        expect(translate('en', 'auth.whatsapp.codeSentTo', { phone: '$& $1' })).toBe('Code sent to $& $1');
        expect(translate('en', 'auth.whatsapp.codeSentTo', { other: 'x' })).toBe('Code sent to {phone}');
    });

    test('t carries its language as t.locale, also from the provider', async () => {
        expect((['ru', 'ky', 'en'] as const).map((locale) => createTranslate(locale).locale)).toEqual(['ru', 'ky', 'en']);
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('ky');
        renderProvider();
        await waitFor(() => expect(textOf('t-locale')).toBe('ky'));
    });

    test('readStoredLocale tells "nothing chosen" from a stored Russian; loadStoredLocale still gives ru', async () => {
        const getItem = SecureStore.getItemAsync as jest.Mock;
        getItem.mockResolvedValueOnce(null);
        await expect(readStoredLocale()).resolves.toBeNull();
        getItem.mockResolvedValueOnce('ru');
        await expect(readStoredLocale()).resolves.toBe('ru');
        getItem.mockResolvedValueOnce('de');
        await expect(readStoredLocale()).resolves.toBeNull();
        getItem.mockRejectedValueOnce(new Error('locked'));
        await expect(readStoredLocale()).resolves.toBeNull();

        getItem.mockResolvedValueOnce(null);
        await expect(loadStoredLocale()).resolves.toBe('ru');
        getItem.mockResolvedValueOnce('ky');
        await expect(loadStoredLocale()).resolves.toBe('ky');
    });

    test('outside the provider the app is Russian', () => {
        render(<Probe />);
        expect(textOf('locale')).toBe('ru');
        expect(textOf('title')).toBe('Вход через WhatsApp');
        expect(textOf('param')).toBe('Отправить снова (42с)');
        expect(textOf('t-locale')).toBe('ru');
    });

    test('the default is Russian when nothing is stored, and the request header says ru', async () => {
        renderProvider();
        await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith(LOCALE_STORAGE_KEY));
        expect(textOf('locale')).toBe('ru');
        expect(getRequestLocale()).toBe('ru');
    });

    test('a stored language is shown, sent to the API, and an unknown stored value is ignored', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('ky');
        const { unmount } = renderProvider();
        await waitFor(() => expect(textOf('locale')).toBe('ky'));
        expect(textOf('title')).toBe('WhatsApp аркылуу кирүү');
        expect(getRequestLocale()).toBe('ky');
        unmount();

        setRequestLocale('ru');
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('de');
        renderProvider();
        await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(2));
        expect(textOf('locale')).toBe('ru');
    });

    test('the switcher changes the language, stores it, and marks the chosen option', async () => {
        renderProvider();
        await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalled());

        expect(screen.getByLabelText('Русский').props.accessibilityState).toMatchObject({ selected: true });
        fireEvent.press(screen.getByText('EN'));

        expect(textOf('locale')).toBe('en');
        expect(textOf('title')).toBe('Sign in with WhatsApp');
        expect(screen.getByLabelText('English').props.accessibilityState).toMatchObject({ selected: true });
        expect(screen.getByLabelText('Русский').props.accessibilityState).toMatchObject({ selected: false });
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'en');
        expect(getRequestLocale()).toBe('en');
        expect(['KG', 'RU', 'EN'].map((label) => screen.getByText(label))).toHaveLength(3);
    });

    test('signed out, a language change is not sent to the profile', async () => {
        renderProvider();
        await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalled());
        fireEvent.press(screen.getByText('KG'));
        await waitFor(() => expect(mockedAuth.getSession).toHaveBeenCalled());
        expect(mockedApiRequest).not.toHaveBeenCalled();
    });

    test('signed in, a language change is saved in the profile; a failure is ignored', async () => {
        signedIn(true);
        mockedApiRequest.mockRejectedValue(new Error('offline'));
        renderProvider();
        await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalled());

        fireEvent.press(screen.getByText('KG'));

        await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledWith('/profile/locale', {
            method: 'POST',
            body: JSON.stringify({ locale: 'ky' }),
        }));
        expect(textOf('locale')).toBe('ky');
    });

    test('after a sign-in, the stored language is saved once per user and language', async () => {
        jest.useFakeTimers();
        try {
            let onAuth: (event: string, session: unknown) => void = () => {};
            mockedAuth.onAuthStateChange.mockImplementation((callback) => {
                onAuth = callback;
                return { data: { subscription: { unsubscribe: jest.fn() } } };
            });
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('en');
            signedIn(true);
            renderProvider();
            await act(async () => {
                await Promise.resolve();
            });

            const session = { access_token: 'token', user: { id: 'user-1' } };
            await act(async () => {
                onAuth('INITIAL_SESSION', session);
                onAuth('SIGNED_IN', session);
                onAuth('SIGNED_IN', session);
                await jest.runAllTimersAsync();
            });

            expect(mockedApiRequest).toHaveBeenCalledTimes(1);
            expect(mockedApiRequest).toHaveBeenCalledWith('/profile/locale', {
                method: 'POST',
                body: JSON.stringify({ locale: 'en' }),
            });
        } finally {
            jest.useRealTimers();
        }
    });

    test('after a sign-in, the default Russian that nobody chose is not sent', async () => {
        jest.useFakeTimers();
        try {
            let onAuth: (event: string, session: unknown) => void = () => {};
            mockedAuth.onAuthStateChange.mockImplementation((callback) => {
                onAuth = callback;
                return { data: { subscription: { unsubscribe: jest.fn() } } };
            });
            signedIn(true);
            renderProvider();
            await act(async () => {
                onAuth('SIGNED_IN', { access_token: 'token', user: { id: 'user-1' } });
                await jest.runAllTimersAsync();
            });
            expect(mockedApiRequest).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    describe('the profile language after a sign-in', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('a stored Russian is an explicit choice and is sent', async () => {
            const auth = captureAuth();
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('ru');
            renderProvider();
            await settle();

            await auth('SIGNED_IN');

            expect(profileLocales()).toEqual(['ru']);
        });

        test('KG, sign out, EN on the sign-in screen, sign in again: the profile gets en', async () => {
            const auth = captureAuth();
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('ky');
            renderProvider();
            await settle();

            await auth('SIGNED_IN');
            await auth('SIGNED_OUT');
            await press('EN');
            expect(profileLocales()).toEqual(['ky']);

            await auth('SIGNED_IN');
            await auth('SIGNED_IN');

            expect(profileLocales()).toEqual(['ky', 'en']);
        });

        test('a change while signed in, then back while signed out: the next sign-in sends it again', async () => {
            const auth = captureAuth();
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('ky');
            renderProvider();
            await settle();

            await auth('SIGNED_IN');
            await press('EN');
            await auth('SIGNED_OUT');
            await press('KG');
            await auth('SIGNED_IN');

            expect(profileLocales()).toEqual(['ky', 'en', 'ky']);
        });

        test('tapping the Russian already shown is a choice: it is stored and sent at the next sign-in', async () => {
            const auth = captureAuth();
            renderProvider();
            await settle();

            await press('RU');
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'ru');
            await auth('SIGNED_IN');

            expect(profileLocales()).toEqual(['ru']);
        });
    });
});
