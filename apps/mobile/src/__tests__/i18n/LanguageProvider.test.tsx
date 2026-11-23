/**
 * Mobile i18n: LanguageProvider, t() and the language switcher.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { LanguageProvider, LanguageSwitcher, translate, useLanguage, type MobileI18nKey } from '../../i18n';
import { en } from '../../i18n/dictionaries/en';
import { ky } from '../../i18n/dictionaries/ky';
import { ru } from '../../i18n/dictionaries/ru';
import { getRequestLocale, setRequestLocale } from '../../i18n/locale';
import { LOCALE_STORAGE_KEY } from '../../i18n/localeStorage';
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

    test('outside the provider the app is Russian', () => {
        render(<Probe />);
        expect(textOf('locale')).toBe('ru');
        expect(textOf('title')).toBe('Вход через WhatsApp');
        expect(textOf('param')).toBe('Отправить снова (42с)');
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

    test('after a sign-in, a stored language other than Russian is saved once per user', async () => {
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

    test('after a sign-in with Russian nothing is sent', async () => {
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
});
