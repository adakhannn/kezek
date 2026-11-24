// Server-only texts of the legal pages (FE-10). They stay out of the client dictionaries: the pages
// are server components, and the long texts would otherwise ship with every page.

import { legalEn } from './dictionaries/legal.en';
import { legalKy } from './dictionaries/legal.ky';
import { legalRu } from './dictionaries/legal.ru';
import { getServerLocale } from './server';

export type LegalKey = keyof typeof legalRu;
type Locale = Awaited<ReturnType<typeof getServerLocale>>;

const DICTIONARIES: Record<Locale, Readonly<Record<string, string>>> = { ru: legalRu, ky: legalKy, en: legalEn };

/** The legal texts in the language of the request (the kezek_lang cookie), Russian by default. */
export async function getLegalT(): Promise<{ locale: Locale; t: (key: LegalKey) => string }> {
    const locale = await getServerLocale();
    const dictionary = DICTIONARIES[locale];
    return { locale, t: (key) => dictionary[key] ?? legalRu[key] };
}

/** Splits a text around its {slot} marker, so a link or a value can sit where the language puts it. */
export function aroundSlot(text: string, slot: string): [string, string] {
    const at = text.indexOf(`{${slot}}`);
    if (at < 0) return [text, ''];
    return [text.slice(0, at), text.slice(at + slot.length + 2)];
}
