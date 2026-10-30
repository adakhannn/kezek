/** Languages using 'other' use the dictionary's general plural form. */
export function bookingCountForm(count: number, locale: 'ru' | 'ky' | 'en'): 'one' | 'few' | 'many' {
    const form = new Intl.PluralRules(locale).select(count);
    return form === 'one' || form === 'few' ? form : 'many';
}
