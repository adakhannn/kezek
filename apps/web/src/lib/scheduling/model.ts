/** Public contract for the explicit scheduling model. Dates are business-local dates. */
export type TimeRange = { start: string; end: string };
export type ScheduleDay = { intervals: TimeRange[]; breaks: TimeRange[] };
export type WeekPlan = Record<string, ScheduleDay>; // ISO weekday: Monday=1, Sunday=7
export type PublishSchedule = {
    kind: 'week' | 'day';
    from: string;
    branchId: string;
    expectedRevision: number;
    days: WeekPlan;
};
export type EffectiveDay = ScheduleDay & {
    date: string;
    branch_id: string | null;
    tz: string;
    source: 'legacy' | 'week' | 'day' | 'absence' | 'unconfigured';
};
export type ScheduleSnapshot = {
    revision: number;
    timezone: string;
    today: string;
    days: EffectiveDay[];
};

export function validDate(value: string): boolean {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function validateRanges(value: unknown): value is TimeRange[] {
    if (!Array.isArray(value) || value.length > 8) return false;
    let end = '';
    return value.every((range) => {
        if (!range || !/^([01]\d|2[0-3]):[0-5]\d$/.test(range.start) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(range.end) ||
            range.start >= range.end || range.start < end) return false;
        end = range.end;
        return true;
    });
}

export function validatePublishSchedule(value: unknown): asserts value is PublishSchedule {
    const input = value as PublishSchedule;
    if (!input || !['week', 'day'].includes(input.kind) || !validDate(input.from) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.branchId) ||
        !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
        !input.days || Array.isArray(input.days)) throw new Error('SCHEDULE_INVALID');
    const keys = input.kind === 'week' ? ['1', '2', '3', '4', '5', '6', '7'] : ['day'];
    if (Object.keys(input.days).length !== keys.length) throw new Error('SCHEDULE_INVALID');
    for (const key of keys) {
        const day = input.days[key];
        validateScheduleDay(day);
        // Internal reset markers may only be written by the dedicated reset operation.
        if (Object.keys(day).some(field => field !== 'intervals' && field !== 'breaks')) {
            throw new Error('SCHEDULE_INVALID');
        }
    }
}

export function validateScheduleDay(value: unknown): asserts value is ScheduleDay {
    const day = value as ScheduleDay;
    if (!day || !validateRanges(day.intervals) || !validateRanges(day.breaks) ||
        day.breaks.some(pause => !day.intervals.some(range =>
            pause.start >= range.start && pause.end <= range.end))) throw new Error('SCHEDULE_INVALID');
}

export function emptyWeek(): WeekPlan {
    return Object.fromEntries(Array.from({ length: 7 }, (_, i) => [String(i + 1), { intervals: [], breaks: [] }]));
}
