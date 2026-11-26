import type { BranchScheduleRow, TimeRange } from './catalogApi';

/** Monday first, Sunday (day_of_week 0) last, as the website's BranchScheduleEditor. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const MAX_RANGES = 8;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Seven rows, one per weekday, from the saved hours (a missing day is closed). */
export function scheduleWeek(saved: BranchScheduleRow[]): BranchScheduleRow[] {
    return WEEK_ORDER.map((day) => {
        const row = saved.find((item) => item.day_of_week === day);
        return {
            day_of_week: day,
            intervals: row?.intervals?.map((range) => ({ ...range })) ?? [],
            breaks: row?.breaks?.map((range) => ({ ...range })) ?? [],
        };
    });
}

export function isTime(value: string): boolean {
    return TIME.test(value);
}

/** "9" -> "9", "930" -> "9:30", "0930" -> "09:30": digits typed on a phone become HH:MM. */
export function formatTimeInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (value.includes(':')) {
        const [h = '', m = ''] = value.split(':');
        return `${h.replace(/\D/g, '').slice(0, 2)}:${m.replace(/\D/g, '').slice(0, 2)}`;
    }
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
}

/** "9:30" -> "09:30" once typing is done; anything else is left as it is. */
export function padTime(value: string): string {
    const match = value.match(/^(\d):(\d{2})$/);
    return match ? `0${match[1]}:${match[2]}` : value;
}

/** Every time of the week as HH:MM ("9:30" -> "09:30"), before the week is checked and sent. */
export function padWeek(days: BranchScheduleRow[]): BranchScheduleRow[] {
    const pad = (ranges: TimeRange[]) => ranges.map((range) => ({ start: padTime(range.start), end: padTime(range.end) }));
    return days.map((day) => ({ ...day, intervals: pad(day.intervals), breaks: pad(day.breaks) }));
}

function validRanges(ranges: TimeRange[]): boolean {
    if (ranges.length > MAX_RANGES) return false;
    let end = '';
    return ranges.every((range) => {
        if (!isTime(range.start) || !isTime(range.end) || range.start >= range.end || range.start < end) return false;
        end = range.end;
        return true;
    });
}

/**
 * The website's validateScheduleDay (lib/scheduling/model.ts): valid HH:MM ranges, start before
 * end, in order without overlaps, at most 8, and every break inside a working interval.
 */
export function isValidScheduleDay(day: Pick<BranchScheduleRow, 'intervals' | 'breaks'>): boolean {
    return validRanges(day.intervals) && validRanges(day.breaks)
        && day.breaks.every((pause) => day.intervals.some((range) => pause.start >= range.start && pause.end <= range.end));
}

export function isValidWeek(days: BranchScheduleRow[]): boolean {
    return days.every(isValidScheduleDay);
}

/** A day without working intervals has no breaks either. */
export function withIntervals(day: BranchScheduleRow, intervals: TimeRange[]): BranchScheduleRow {
    return { ...day, intervals, breaks: intervals.length ? day.breaks : [] };
}
