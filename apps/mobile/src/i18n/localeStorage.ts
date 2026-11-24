import * as SecureStore from 'expo-secure-store';

import { logWarn } from '../lib/log';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locale';

/** The chosen app language on this device; it outlives sign-out, like the website cookie. */
export const LOCALE_STORAGE_KEY = 'kezek_locale';

/**
 * The language chosen on this device, or null when none is: nothing valid is stored or the store
 * cannot be read. Unlike loadStoredLocale, a stored 'ru' and no choice differ.
 */
export async function readStoredLocale(): Promise<Locale | null> {
    try {
        const value = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
        return isLocale(value) ? value : null;
    } catch (error) {
        logWarn('i18n', 'Failed to read the stored language', error);
        return null;
    }
}

/** The stored language, or Russian when nothing valid is stored or the store cannot be read. */
export async function loadStoredLocale(): Promise<Locale> {
    return (await readStoredLocale()) ?? DEFAULT_LOCALE;
}

/** Saves the language; a failure is logged and the app keeps the language for this run. */
export async function saveStoredLocale(locale: Locale): Promise<void> {
    try {
        await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
    } catch (error) {
        logWarn('i18n', 'Failed to store the language', error);
    }
}
