import { formatInTimeZone } from 'date-fns-tz';

/**
 * Calendar weeks of a business (ARCH-11), the rule of the website's lib/scheduling/businessWeek.ts:
 * a week runs Monday to Sunday in the business time zone, whatever zone the phone is in.
 */

const DAY_MS = 86_400_000;

/** `ymd` (YYYY-MM-DD) shifted by `days` calendar days. */
export function addDaysYmd(ymd: string, days: number): string {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Today (YYYY-MM-DD) in the business time zone. */
export function businessTodayYmd(tz: string, now: Date = new Date()): string {
    return formatInTimeZone(now, tz, 'yyyy-MM-dd');
}

/** The seven dates, Monday first, of the business week `weekOffset` weeks from the current one. */
export function businessWeekYmds(weekOffset: number, tz: string, now: Date = new Date()): string[] {
    const today = businessTodayYmd(tz, now);
    const isoWeekday = Number(formatInTimeZone(now, tz, 'i')); // 1 = Monday … 7 = Sunday
    const monday = addDaysYmd(today, 1 - isoWeekday + 7 * weekOffset);
    return Array.from({ length: 7 }, (_, index) => addDaysYmd(monday, index));
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a calendar date. */
export function isoWeekdayOfYmd(ymd: string): number {
    const [year, month, day] = ymd.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekday === 0 ? 7 : weekday;
}
