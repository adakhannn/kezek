/**
 * App.tsx: the crash screen (ErrorBoundary → ErrorDisplay) is inside LanguageProvider, so it is in
 * the chosen language rather than always in Russian.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import App from '../../../App';
import { setRequestLocale } from '../../i18n/locale';
import { LOCALE_STORAGE_KEY } from '../../i18n/localeStorage';

jest.mock('../../navigation/RootNavigator', () => ({
    __esModule: true,
    default: function CrashingNavigator(): never {
        throw new Error('Rendered more hooks than during the previous render.');
    },
}));

jest.mock('../../utils/debug', () => ({ logEnvVars: jest.fn() }));

describe('the crash screen', () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        // React and the logger report the caught render error; it is expected here.
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
            key === LOCALE_STORAGE_KEY ? 'en' : null,
        );
    });

    afterEach(() => {
        consoleError.mockRestore();
        (SecureStore.getItemAsync as jest.Mock).mockReset();
        setRequestLocale('ru');
    });

    test('speaks the stored language', async () => {
        render(<App />);

        expect(await screen.findByText('Something went wrong')).toBeTruthy();
        expect(screen.getByText('The app ran into an error. Try again, and if that does not help, restart the app.')).toBeTruthy();
        // The render error is English and readable, but technical: it is never shown.
        expect(screen.queryByText(/Rendered more hooks/)).toBeNull();
        expect(screen.getByText('Try again')).toBeTruthy();
        expect(screen.queryByText('Что-то пошло не так')).toBeNull();
    });
});
