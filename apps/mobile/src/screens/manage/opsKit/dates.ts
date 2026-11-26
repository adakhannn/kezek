import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

/*
 * Calendar dates of the business management screens. A date is a `YYYY-MM-DD` string of the
 * business day (businesses.tz), as on the website (lib/time: todayStringInTz, dayBoundsInTz).
 */

/** A real calendar date in the `YYYY-MM-DD` form. */
export function isValidDateString(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Today in the business time zone. */
export function todayInTz(timeZone: string | null | undefined, now: Date = new Date()): string {
    return formatInTimeZone(now, resolveBusinessTimeZone(timeZone), 'yyyy-MM-dd');
}

/** `date` moved by `days` calendar days (no time zone involved). */
export function addDaysToDate(date: string, days: number): string {
    const parsed = new Date(`${date}T00:00:00Z`);
    parsed.setUTCDate(parsed.getUTCDate() + days);
    return parsed.toISOString().slice(0, 10);
}

/** The business day as instants [start, end): what the website's dayBoundsInTz gives. */
export function dayBoundsInTz(date: string, timeZone: string | null | undefined): { start: Date; end: Date } {
    const tz = resolveBusinessTimeZone(timeZone);
    return {
        start: fromZonedTime(`${date}T00:00:00`, tz),
        end: fromZonedTime(`${addDaysToDate(date, 1)}T00:00:00`, tz),
    };
}

/** The first and the last instant of the business day, as the website's calendar reads it. */
export function dayRangeInclusive(date: string, timeZone: string | null | undefined): { start: string; end: string } {
    const tz = resolveBusinessTimeZone(timeZone);
    return {
        start: fromZonedTime(`${date}T00:00:00`, tz).toISOString(),
        end: fromZonedTime(`${date}T23:59:59.999`, tz).toISOString(),
    };
}

/** The hour (0-23) of an instant on the business clock. */
export function hourInTz(iso: string, timeZone: string | null | undefined): number {
    return Number(formatInTimeZone(new Date(iso), resolveBusinessTimeZone(timeZone), 'H'));
}
