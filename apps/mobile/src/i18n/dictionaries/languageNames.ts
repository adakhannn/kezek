import type { Locale } from '../locale';

/**
 * Language names for the switcher. Each is written in its own language and is the same in every
 * locale, so it is not a dictionary key. The short labels match the website switcher.
 */
export const LANGUAGE_SHORT_LABELS: Readonly<Record<Locale, string>> = {
    ky: 'KG',
    ru: 'RU',
    en: 'EN',
};

export const LANGUAGE_NAMES: Readonly<Record<Locale, string>> = {
    ky: 'Кыргызча',
    ru: 'Русский',
    en: 'English',
};
