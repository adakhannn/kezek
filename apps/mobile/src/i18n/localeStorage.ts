import * as SecureStore from 'expo-secure-store';

import { logWarn } from '../lib/log';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locale';

/** The chosen app language on this device; it outlives sign-out, like the website cookie. */
export const LOCALE_STORAGE_KEY = 'kezek_locale';

/** The stored language, or Russian when nothing valid is stored or the store cannot be read. */
export async function loadStoredLocale(): Promise<Locale> {
    try {
        const value = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
        return isLocale(value) ? value : DEFAULT_LOCALE;
    } catch (error) {
        logWarn('i18n', 'Failed to read the stored language', error);
        return DEFAULT_LOCALE;
    }
}

/** Saves the language; a failure is logged and the app keeps the language for this run. */
export async function saveStoredLocale(locale: Locale): Promise<void> {
    try {
        await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
    } catch (error) {
        logWarn('i18n', 'Failed to store the language', error);
    }
}
