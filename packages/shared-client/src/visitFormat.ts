import { formatInTimeZone } from 'date-fns-tz';

import { resolveBusinessTimeZone } from './timezone';

/**
 * The owner's visit format (one text for the app, the site and notifications):
 * - a day: «27 нояб.», ky «27-ноябрь», en «Nov 27»; the year only when it is not the current one
 *   («27 нояб. 2025», ky «2025-ж., 27-ноябрь», en «Nov 27, 2025»);
 * - a range: «10:00–11:00» (en dash, no spaces);
 * - day and time together: «27 нояб. • 10:00–11:00» or «27 нояб. • 19:00».
 *
 * Month names are fixed here, not taken from Intl: many browsers and devices have no Kyrgyz ICU data
 * and would print another language. Times are in the business zone (`businesses.tz`; NULL or unknown
 * means Asia/Bishkek, ARCH-11).
 */

export type VisitLocale = 'ru' | 'ky' | 'en';

/** Russian abbreviated months in the genitive, as ru-RU Intl `month: 'short'` writes them after a day. */
const RU_MONTHS_SHORT = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'] as const;
/** Kyrgyz months: Kyrgyz has no settled abbreviations, so the full name follows the day («27-ноябрь»). */
const KY_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'] as const;
const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Separator between a day and a time. */
export const VISIT_DATE_TIME_SEPARATOR = ' • ';

function toDate(value: string | Date): Date {
    return typeof value === 'string' ? new Date(value) : value;
}

/** «10:00» in the business zone. */
export function formatVisitTime(value: string | Date, timeZone?: string | null): string {
    return formatInTimeZone(toDate(value), resolveBusinessTimeZone(timeZone), 'HH:mm');
}

/** «27 нояб.» (ky «27-ноябрь», en «Nov 27»); the year is added only when it differs from `now`'s year. */
export function formatVisitDate(
    value: string | Date,
    locale: VisitLocale,
    timeZone?: string | null,
    now: Date = new Date(),
): string {
    const tz = resolveBusinessTimeZone(timeZone);
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) return '';
    const [year, month, day] = formatInTimeZone(date, tz, 'yyyy|M|d').split('|');
    const monthIndex = Number(month) - 1;
    const showYear = year !== formatInTimeZone(now, tz, 'yyyy');
    if (locale === 'ky') {
        const dayMonth = `${day}-${KY_MONTHS[monthIndex]}`;
        return showYear ? `${year}-ж., ${dayMonth}` : dayMonth;
    }
    if (locale === 'en') {
        const monthDay = `${EN_MONTHS_SHORT[monthIndex]} ${day}`;
        return showYear ? `${monthDay}, ${year}` : monthDay;
    }
    const dayMonth = `${day} ${RU_MONTHS_SHORT[monthIndex]}`;
    return showYear ? `${dayMonth} ${year}` : dayMonth;
}

/** «10:00–11:00»; without an end (or a broken one) just «10:00». */
export function formatVisitRange(
    start: string | Date,
    end: string | Date | null | undefined,
    timeZone?: string | null,
): string {
    const from = formatVisitTime(start, timeZone);
    if (end == null) return from;
    const endDate = toDate(end);
    if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= toDate(start).getTime()) return from;
    return `${from}–${formatVisitTime(endDate, timeZone)}`;
}

/** «27 нояб. • 10:00–11:00», or «27 нояб. • 19:00» when there is no end. */
export function formatVisitWhen(
    start: string | Date,
    end: string | Date | null | undefined,
    locale: VisitLocale,
    timeZone?: string | null,
    now: Date = new Date(),
): string {
    return `${formatVisitDate(start, locale, timeZone, now)}${VISIT_DATE_TIME_SEPARATOR}${formatVisitRange(start, end, timeZone)}`;
}
