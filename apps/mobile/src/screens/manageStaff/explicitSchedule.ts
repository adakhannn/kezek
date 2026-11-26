import type { BranchHoursWire } from './api';
import type { ScheduleDayPlan, TimeRange, WeekPlan } from './types';

/**
 * The explicit scheduling model (SCHEDULE_V2_ENABLED): the checks of
 * apps/web/src/lib/scheduling/model.ts that the website's ScheduleEditor runs before publishing,
 * and the TimeOffEditor's date checks. The server checks again.
 */

export function validDate(value: string): boolean {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function validRanges(value: unknown): value is TimeRange[] {
    if (!Array.isArray(value) || value.length > 8) return false;
    let end = '';
    return value.every((range: TimeRange) => {
        if (!range || !/^([01]\d|2[0-3]):[0-5]\d$/.test(range.start)
            || !/^([01]\d|2[0-3]):[0-5]\d$/.test(range.end)
            || range.start >= range.end || range.start < end) return false;
        end = range.end;
        return true;
    });
}

export function validScheduleDay(day: ScheduleDayPlan | undefined): boolean {
    return !!day && validRanges(day.intervals) && validRanges(day.breaks)
        && day.breaks.every((pause) => day.intervals.some((range) => pause.start >= range.start && pause.end <= range.end));
}

export type PublishBody = { kind: 'week' | 'day'; from: string; branchId: string; expectedRevision: number; days: WeekPlan };

export function validPublishSchedule(input: PublishBody): boolean {
    if (!input || !['week', 'day'].includes(input.kind) || !validDate(input.from)
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.branchId)
        || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
        || !input.days || Array.isArray(input.days)) return false;
    const keys = input.kind === 'week' ? ['1', '2', '3', '4', '5', '6', '7'] : ['day'];
    if (Object.keys(input.days).length !== keys.length) return false;
    return keys.every((key) => {
        const day = input.days[key];
        return validScheduleDay(day) && Object.keys(day).every((field) => field === 'intervals' || field === 'breaks');
    });
}

export function emptyWeek(): WeekPlan {
    return Object.fromEntries(Array.from({ length: 7 }, (_, i) => [String(i + 1), { intervals: [], breaks: [] }]));
}

export function emptyDay(): WeekPlan {
    return { day: { intervals: [], breaks: [] } };
}

/** "Fill the draft from branch hours": branch rows (0 = Sunday) to ISO weekdays (Sunday = 7). */
export function weekFromBranchHours(rows: BranchHoursWire[]): WeekPlan {
    const draft = emptyWeek();
    for (const row of rows) {
        draft[String(row.day_of_week === 0 ? 7 : row.day_of_week)] = { intervals: row.intervals ?? [], breaks: row.breaks ?? [] };
    }
    return draft;
}

/** Date shifted by `days` (the period navigation moves two weeks). */
export function shiftYmd(ymd: string, days: number): string {
    const date = new Date(`${ymd}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

/** The TimeOffEditor's rule: from today or later, to on or after from, at most 365 days. */
export function validTimeOff(from: string, to: string, today: string): boolean {
    return !!from && !!to && validDate(from) && validDate(to) && from >= today && to >= from
        && (Date.parse(to) - Date.parse(from)) / 86_400_000 <= 365;
}
