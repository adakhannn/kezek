import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// Hermes and many devices ship no Kyrgyz ICU data: `Intl.DateTimeFormat('ky-KG')` silently
// formats in another language there. Kyrgyz dates are rendered here without Intl, following the
// full-ICU ky patterns, as apps/web/src/lib/kyDateFormat.ts does on the website.
// The Kyrgyz words themselves are in dictionaries/kyCalendar.ts.
import { KY_MONTHS, KY_WEEKDAYS, KY_WEEKDAYS_SHORT, kyYearLabel as yearLabel } from './dictionaries/kyCalendar';

export { KY_MONTHS, KY_WEEKDAYS, KY_WEEKDAYS_SHORT };

/** The subset of Intl.DateTimeFormatOptions the Kyrgyz formatter understands. */
export type KyDateOptions = Pick<
    Intl.DateTimeFormatOptions,
    'weekday' | 'day' | 'month' | 'year' | 'hour' | 'minute' | 'timeZone' | 'dateStyle' | 'timeStyle'
>;

type Parts = { year: string; month: number; day: number; dd: string; mm: string; weekday: number; time: string };

function dateParts(date: Date, timeZone?: string): Parts {
    const pattern = 'yyyy|MM|dd|i|HH:mm';
    const raw = timeZone ? formatInTimeZone(date, timeZone, pattern) : format(date, pattern);
    const [year, mm, dd, weekday, time] = raw.split('|');
    return { year, month: Number(mm), day: Number(dd), dd, mm, weekday: Number(weekday), time };
}

function expandStyles(options: KyDateOptions): KyDateOptions {
    const { dateStyle, timeStyle, ...rest } = options;
    const expanded: KyDateOptions = { ...rest };
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
 * With no date or time option it gives the numeric date.
 */
export function formatKyDate(date: Date, options: KyDateOptions = {}): string {
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

/** The Kyrgyz month name of a 1-based month number. */
export function kyMonthName(month: number): string {
    return KY_MONTHS[month - 1] ?? '';
}

/** The short Kyrgyz weekday name of an ISO weekday (1 = Monday .. 7 = Sunday). */
export function kyWeekdayShort(isoWeekday: number): string {
    return KY_WEEKDAYS_SHORT[isoWeekday - 1] ?? '';
}
