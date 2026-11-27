/**
 * The sign-in screens in Kyrgyz: the language stored on the device is used before signing in.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { LanguageProvider } from '../../../i18n';
import { supabase } from '../../../lib/supabase';
import { setRequestLocale } from '../../../i18n/locale';
import { LOCALE_STORAGE_KEY } from '../../../i18n/localeStorage';
import SignInScreen from '../../../screens/auth/SignInScreen';
import WhatsAppScreen from '../../../screens/auth/WhatsAppScreen';

jest.mock('@react-navigation/native', () => ({
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../../../lib/analytics', () => ({ trackMobileEvent: jest.fn() }));

describe('auth screens in Kyrgyz', () => {
    beforeEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
            key === LOCALE_STORAGE_KEY ? 'ky' : null,
        );
        (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
        (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
    });

    afterEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockReset();
        setRequestLocale('ru');
    });

    test('WhatsApp sign-in speaks Kyrgyz', async () => {
        render(
            <LanguageProvider>
                <WhatsAppScreen />
            </LanguageProvider>,
        );

        expect(await screen.findByText('Телефон номериңизди жазыңыз, ага WhatsApp аркылуу код келет.', {}, { timeout: 5000 })).toBeTruthy();
        expect(screen.getByText('Кодду жөнөтүү')).toBeTruthy();
        expect(screen.getByText('Башка кирүү ыкмаларына кайтуу')).toBeTruthy();
        expect(screen.queryByText('Введите номер телефона, на него придёт код в WhatsApp.')).toBeNull();
    });

    test('the sign-in screen offers the switcher and changes language in place', async () => {
        render(
            <LanguageProvider>
                <SignInScreen />
            </LanguageProvider>,
        );

        expect(await screen.findByText('Сыр сөзсүз тез кирүү', {}, { timeout: 5000 })).toBeTruthy();
        expect(screen.getByText('Google аркылуу улантуу')).toBeTruthy();
        expect(screen.getByLabelText('Кыргызча').props.accessibilityState).toMatchObject({ selected: true });

        fireEvent.press(screen.getByText('RU'));
        expect(screen.getByText('Быстрый вход без пароля')).toBeTruthy();
        expect(screen.getByText('Продолжить с Google')).toBeTruthy();
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'ru');
    });
});
