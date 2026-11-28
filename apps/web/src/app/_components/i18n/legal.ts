// Server-only texts of the legal pages (FE-10). They stay out of the client dictionaries: the pages
// are server components, and the long texts would otherwise ship with every page.


import { legalEn } from './dictionaries/legal.en';
import { legalKy } from './dictionaries/legal.ky';
import { legalRu } from './dictionaries/legal.ru';
import { getServerLocale } from './server';

import { formatLocalizedDate } from '@/lib/kyDateFormat';

export type LegalKey = keyof typeof legalRu;
type Locale = Awaited<ReturnType<typeof getServerLocale>>;

const DICTIONARIES: Record<Locale, Readonly<Record<string, string>>> = { ru: legalRu, ky: legalKy, en: legalEn };

/** The legal texts in the language of the request (the kezek_lang cookie), Russian by default. */
export async function getLegalT(): Promise<{ locale: Locale; t: (key: LegalKey) => string }> {
    const locale = await getServerLocale();
    const dictionary = DICTIONARIES[locale];
    return { locale, t: (key) => dictionary[key] ?? legalRu[key] };
}

/**
 * The date the legal texts were last changed. A fixed date, not the day the page is opened:
 * change it together with the texts in dictionaries/legal.*.ts.
 */
export const LEGAL_UPDATED_AT = new Date('2026-11-28T12:00:00+06:00');

/** The update date in the owner's style: «28 ноября 2026», «2026-ж., 28-ноябрь», «November 28, 2026». */
export function formatLegalUpdatedAt(locale: Locale): string {
    const formatted = formatLocalizedDate(LEGAL_UPDATED_AT, locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Bishkek',
    });
    return locale === 'ru' ? formatted.replace(/\s*г\.$/, '') : formatted;
}

/** Splits a text around its {slot} marker, so a link or a value can sit where the language puts it. */
export function aroundSlot(text: string, slot: string): [string, string] {
    const at = text.indexOf(`{${slot}}`);
    if (at < 0) return [text, ''];
    return [text.slice(0, at), text.slice(at + slot.length + 2)];
}
