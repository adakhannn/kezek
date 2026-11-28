import { formatInTimeZone } from 'date-fns-tz';

import { visitDateEn } from '@/app/_components/i18n/dictionaries/visitDate.en';
import { visitDateKy } from '@/app/_components/i18n/dictionaries/visitDate.ky';
import { visitDateRu } from '@/app/_components/i18n/dictionaries/visitDate.ru';

/**
 * Owner format for a visit's date and time (see .claude/skills/kezek-engineering):
 * «27 нояб. • 09:00–10:00». Short month, en dash without spaces in the range, no
 * «г.», no time-zone name. The year is shown only when it is not the current year
 * (in the business time zone).
 *
 * Month names and the day/month order come from the visitDate dictionaries (not Intl),
 * so the server, browsers without Kyrgyz ICU data and the jest runtime give the same text.
 */

export type VisitLocale = 'ru' | 'ky' | 'en';

const DICTIONARIES: Record<VisitLocale, Record<string, string>> = { ru: visitDateRu, ky: visitDateKy, en: visitDateEn };

function toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
}

function fill(template: string, values: Record<string, string>): string {
    return template.replace(/\{(day|month|year)\}/g, (_match, name: string) => values[name] ?? '');
}

/** «27 нояб.» / «27-ноя.» / «Nov 27»; with the year when it differs from `now`'s year. */
export function formatVisitDay(
    start: Date | string,
    timeZone: string,
    locale: VisitLocale,
    now: Date = new Date(),
): string {
    const date = toDate(start);
    if (Number.isNaN(date.getTime())) return '';
    const dictionary = DICTIONARIES[locale] ?? DICTIONARIES.ru;
    const [year, month, day] = formatInTimeZone(date, timeZone, 'yyyy|M|d').split('|');
    const showYear = year !== formatInTimeZone(now, timeZone, 'yyyy');
    const template = showYear ? dictionary['visitDate.dayMonthYear'] : dictionary['visitDate.dayMonth'];
    return fill(template, { day, month: dictionary[`visitDate.month.${month}`], year });
}

/** «09:00–10:00» (en dash, no spaces); only the start when the end is missing or not after it. */
export function formatVisitTimeRange(start: Date | string, end: Date | string | null | undefined, timeZone: string): string {
    const startDate = toDate(start);
    if (Number.isNaN(startDate.getTime())) return '';
    const from = formatInTimeZone(startDate, timeZone, 'HH:mm');
    const endDate = end ? toDate(end) : null;
    if (!endDate || Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) return from;
    return `${from}–${formatInTimeZone(endDate, timeZone, 'HH:mm')}`;
}

/** «27 нояб. • 09:00–10:00» in the business time zone. */
export function formatVisitDateRange(
    start: Date | string,
    end: Date | string | null | undefined,
    timeZone: string,
    locale: VisitLocale,
    now: Date = new Date(),
): string {
    const day = formatVisitDay(start, timeZone, locale, now);
    const time = formatVisitTimeRange(start, end, timeZone);
    return day && time ? `${day} • ${time}` : day || time;
}
