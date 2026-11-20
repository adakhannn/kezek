import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// Many browsers ship no Kyrgyz ICU data: `new Intl.DateTimeFormat('ky-KG')`
// silently formats in the browser's own language there. Kyrgyz dates are
// therefore rendered here without Intl, following the full-ICU ky patterns.

/** Kyrgyz weekday names, Monday first (ISO weekday 1..7). */
export const KY_WEEKDAYS = ['дүйшөмбү', 'шейшемби', 'шаршемби', 'бейшемби', 'жума', 'ишемби', 'жекшемби'] as const;
/** Kyrgyz month names, January first. */
export const KY_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'] as const;

/** The subset of Intl.DateTimeFormatOptions the Kyrgyz formatter understands. */
export type LocalizedDateOptions = Pick<
    Intl.DateTimeFormatOptions,
    'weekday' | 'day' | 'month' | 'year' | 'hour' | 'minute' | 'timeZone' | 'dateStyle' | 'timeStyle'
>;

const yearLabel = (year: string) => `${year}-ж.`;

type Parts ={ year: string; month: number; day: number; dd: string; mm: string; weekday: number; time: string };

function dateParts(date: Date, timeZone?: string): Parts {
    const pattern = 'yyyy|MM|dd|i|HH:mm';
    const raw = timeZone ? formatInTimeZone(date, timeZone, pattern) : format(date, pattern);
    const [year, mm, dd, weekday, time] = raw.split('|');
    return { year, month: Number(mm), day: Number(dd), dd, mm, weekday: Number(weekday), time };
}

function expandStyles(options: LocalizedDateOptions): LocalizedDateOptions {
    const { dateStyle, timeStyle, ...rest } = options;
    const expanded: LocalizedDateOptions = { ...rest };
    if (dateStyle === 'full') Object.assign(expanded, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    else if (dateStyle === 'long' || dateStyle === 'medium') Object.assign(expanded, { day: 'numeric', month: 'long', year: 'numeric' });
    else if (dateStyle === 'short') Object.assign(expanded, { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (timeStyle) Object.assign(expanded, { hour: '2-digit', minute: '2-digit' });
    return expanded;
}

/**
 * Formats a date in Kyrgyz without Intl:
 * - day + long month: "20-ноябрь"; with a year: "2026-ж., 20-ноябрь";
 * - long month + year: "2026-ж., ноябрь";
 * - a weekday follows the date: "20-ноябрь, жума";
 * - a numeric month: "20.11.2026";
 * - a time is HH:mm, after the date: "2026-ж., 20-ноябрь 14:00".
 * With no date or time option it gives the numeric date, like toLocaleDateString().
 */
export function formatKyDate(date: Date, options: LocalizedDateOptions = {}): string {
    if (Number.isNaN(date.getTime())) return 'Invalid Date';
    const o = expandStyles(options);
    const p = dateParts(date, o.timeZone);
    const hasTime = Boolean(o.hour || o.minute);
    const hasDate = Boolean(o.weekday || o.day || o.month || o.year);
    const weekday = o.weekday ? KY_WEEKDAYS[p.weekday - 1] : '';

    let datePart = '';
    if (!hasDate && !hasTime) {
        datePart = `${p.dd}.${p.mm}.${p.year}`;
    } else if (o.month === 'long' || o.month === 'short' || o.month === 'narrow') {
        const dayMonth = o.day ? `${p.day}-${KY_MONTHS[p.month - 1]}` : KY_MONTHS[p.month - 1];
        datePart = o.year ? `${yearLabel(p.year)}, ${dayMonth}` : dayMonth;
        if (weekday) datePart = `${datePart}, ${weekday}`;
    } else if (o.month || o.day) {
        const numeric = [o.day ? p.dd : null, o.month ? p.mm : null, o.year ? p.year : null].filter(Boolean).join('.');
        datePart = weekday ? `${numeric}, ${weekday}` : numeric;
    } else if (o.year) {
        datePart = weekday ? `${yearLabel(p.year)}, ${weekday}` : yearLabel(p.year);
    } else if (weekday) {
        datePart = weekday;
    }

    if (!hasTime) return datePart;
    return datePart ? `${datePart} ${p.time}` : p.time;
}

/**
 * Formats a date for a UI locale: Kyrgyz through formatKyDate (no ICU needed),
 * Russian with ru-RU and English with `englishLocale` through Intl.
 * Unknown locales fall back to ru-RU.
 */
export function formatLocalizedDate(
    date: Date,
    locale: string,
    options: LocalizedDateOptions = {},
    englishLocale: 'en-US' | 'en-GB' = 'en-US',
): string {
    if (locale === 'ky') return formatKyDate(date, options);
    if (Number.isNaN(date.getTime())) return 'Invalid Date';
    return new Intl.DateTimeFormat(locale === 'en' ? englishLocale : 'ru-RU', options).format(date);
}
