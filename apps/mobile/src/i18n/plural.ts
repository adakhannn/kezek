import type { MobileI18nKey } from './dictionaries/ru';
import type { Locale } from './locale';
import type { Translate, TranslateParams } from './translate';

/**
 * Plural forms of a text with a number, without Intl.PluralRules (Hermes may not have it). Such a
 * text is written in every dictionary as `<key>.one`, `<key>.few` and `<key>.many`, with `{count}`.
 */
export type PluralForm = 'one' | 'few' | 'many';

type PluralBase<K> = K extends `${infer Base}.many`
    ? (`${Base}.one` | `${Base}.few`) extends MobileI18nKey
        ? Base
        : never
    : never;

/** A key whose three forms are in the dictionaries, such as 'staff.shifts.clientsCount'. */
export type PluralKey = PluralBase<MobileI18nKey>;

/**
 * The form for a whole number `count`:
 * - ru: one for 1, 21, 101…; few for 2–4, 22–24…; many for 0, 5–20, 25–30, 111–114…;
 * - en: one for exactly 1, otherwise many (`.few` repeats `.many` in the dictionary);
 * - ky: a noun does not change after a number, so always one (the three texts are the same).
 */
export function pluralForm(count: number, locale: Locale): PluralForm {
    if (locale === 'ky') return 'one';
    if (locale === 'en') return count === 1 ? 'one' : 'many';
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'many';
    if (last === 1) return 'one';
    if (last >= 2 && last <= 4) return 'few';
    return 'many';
}

/** The form of `key` for `count` in the language of `t`, with `{count}` (and `params`) filled in. */
export function translatePlural(t: Translate, key: PluralKey, count: number, params?: TranslateParams): string {
    return t(`${key}.${pluralForm(count, t.locale)}`, { ...params, count });
}
