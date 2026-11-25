import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * Calendar weeks of a business (ARCH-11). A week runs Monday to Sunday in the business time zone,
 * whatever zone the browser or the server runs in: `startOfWeek(new Date())` would start it from the
 * runtime's local date, which near midnight is another day than the business's.
 */

const DAY_MS = 86_400_000;

/** `ymd` (YYYY-MM-DD) shifted by `days` calendar days. */
export function addDaysYmd(ymd: string, days: number): string {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The seven dates (YYYY-MM-DD), Monday first, of the business week `weekOffset` weeks from the current one. */
export function businessWeekYmds(weekOffset: number, tz: string, now: Date = new Date()): string[] {
    const today = formatInTimeZone(now, tz, 'yyyy-MM-dd');
    const isoWeekday = Number(formatInTimeZone(now, tz, 'i')); // 1 = Monday … 7 = Sunday
    const monday = addDaysYmd(today, 1 - isoWeekday + 7 * weekOffset);
    return Array.from({ length: 7 }, (_, index) => addDaysYmd(monday, index));
}

/**
 * The same week as instants at noon in the business time zone: `formatInTimeZone(date, tz, …)` gives
 * back exactly that business date, so components can keep formatting `Date`s.
 */
export function businessWeekDates(weekOffset: number, tz: string, now: Date = new Date()): Date[] {
    return businessWeekYmds(weekOffset, tz, now).map((ymd) => fromZonedTime(`${ymd}T12:00:00`, tz));
}

/** Day of the week of `date` in the business time zone, numbered like `Date.getDay()` (0 = Sunday). */
export function businessDayOfWeek(date: Date, tz: string): number {
    return Number(formatInTimeZone(date, tz, 'i')) % 7;
}
