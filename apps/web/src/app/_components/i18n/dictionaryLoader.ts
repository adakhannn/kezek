/**
 * Which dictionaries a browser holds (FE-06). Russian ships with every page: it is the fallback
 * for missing keys and the default locale. English and Kyrgyz come from the server layout for a
 * page rendered in them, or as separate chunks when the visitor switches language - every page
 * used to carry all three (~790 KB of source).
 */
import { ru } from './dictionaries/ru';

export type DictionaryLocale = 'ru' | 'en' | 'ky';
type Translations = Record<string, string>;

const cache: Partial<Record<DictionaryLocale, Translations>> = { ru };

export const russianDictionary: Translations = ru;

/** A dictionary already in memory, or undefined. */
export function loadedDictionary(locale: DictionaryLocale): Translations | undefined {
    return cache[locale];
}

/** Keeps a dictionary the server sent (or a test preloads) for later providers. */
export function rememberDictionary(locale: DictionaryLocale, dictionary: Translations): void {
    cache[locale] = dictionary;
}

/** Loads a dictionary chunk on demand. */
export async function loadDictionary(locale: DictionaryLocale): Promise<Translations> {
    const cached = cache[locale];
    if (cached) return cached;
    const dictionary = locale === 'en'
        ? (await import('./dictionaries/en')).en
        : locale === 'ky'
            ? (await import('./dictionaries/ky')).ky
            : ru;
    cache[locale] = dictionary;
    return dictionary;
}
