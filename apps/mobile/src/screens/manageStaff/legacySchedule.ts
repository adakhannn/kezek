import type { MobileI18nKey } from '../../i18n';
import type { BranchHoursRow, LegacyRule, TimeRange } from './types';

/**
 * The legacy (date-rule) staff schedule editor of /dashboard/staff/[id]/schedule, used while
 * SCHEDULE_V2_ENABLED is off: the rules of apps/web/src/lib/scheduling/legacyDefaults.ts and
 * useStaffScheduleRules.ts (FE-02). Viewing never writes; closed branch days stay days off, past
 * days are not written, temporary transfers are kept.
 */

/** Day of week (0 = Sunday) of a calendar date, independent of the phone's time zone. */
export function weekdayOf(ymd: string): number {
    return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

/** The calendar date after ymd. */
export function nextYmd(ymd: string): string {
    const date = new Date(`${ymd}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

/**
 * Branch hours of a date: undefined when the branch has no hours configured at all, [] when the
 * branch is closed that weekday.
 */
export function branchDayIntervals(rows: BranchHoursRow[], ymd: string): TimeRange[] | undefined {
    if (rows.length === 0) return undefined;
    const intervals = rows.find((row) => row.day_of_week === weekdayOf(ymd))?.intervals;
    if (!Array.isArray(intervals)) return [];
    return intervals.filter((range) => Boolean(range?.start && range?.end && range.start < range.end));
}

/** The dictionary key of a failed legacy schedule write (legacyScheduleWriteMessage). */
export function legacyScheduleWriteMessageKey(error: unknown): MobileI18nKey {
    const { code, message = '' } = (error ?? {}) as { code?: string; message?: string };
    if (message.includes('SCHEDULE_USE_PUBLICATION_EDITOR')) return 'manageStaff.staff.schedule.useNewEditor';
    if (code === '42501' || /row-level security/i.test(message)) return 'manageStaff.staff.schedule.noPermission';
    if (code === '23505') return 'manageStaff.staff.schedule.staleConflict';
    if (code === 'PGRST116') return 'manageStaff.staff.schedule.notApplied';
    return 'manageStaff.staff.schedule.saveError';
}

/**
 * Rows of one date as resolve_staff_day_legacy reads them: ordered by date, priority desc, newest
 * first, the first row of a date wins.
 */
export function winningRules(
    rows: { id: string; date_on: string | null; intervals: unknown; branch_id: string | null }[],
    homeBranchId: string,
): Map<string, LegacyRule> {
    const winners = new Map<string, LegacyRule>();
    for (const rule of rows) {
        if (!rule.date_on || winners.has(rule.date_on)) continue;
        winners.set(rule.date_on, {
            id: rule.id,
            intervals: (Array.isArray(rule.intervals) ? rule.intervals : []) as TimeRange[],
            branch_id: rule.branch_id || homeBranchId,
        });
    }
    return winners;
}

export type BranchSchedulePlan = { dates: string[]; overwrite: number; keptTransfers: number };

export type PlanResult =
    | { ok: true; plan: BranchSchedulePlan }
    | { ok: false; error: MobileI18nKey };

/** Days "apply branch hours" would write, decided when the manager taps it. */
export function planBranchSchedule(
    windowDates: string[],
    today: string,
    rulesByDate: Map<string, LegacyRule>,
    homeBranchId: string,
    branchHours: BranchHoursRow[] | null,
): PlanResult {
    if (branchHours === null) return { ok: false, error: 'manageStaff.staff.schedule.branchHoursUnavailable' };
    if (branchHours.length === 0) return { ok: false, error: 'manageStaff.staff.schedule.branchHoursMissing' };
    const plan: BranchSchedulePlan = { dates: [], overwrite: 0, keptTransfers: 0 };
    for (const date of windowDates) {
        if (date < today) continue;
        const saved = rulesByDate.get(date);
        if (saved && saved.branch_id !== homeBranchId) {
            plan.keptTransfers += 1;
            continue;
        }
        if (saved) plan.overwrite += 1;
        plan.dates.push(date);
    }
    return { ok: true, plan };
}

/** The upsert rows of the plan: one statement, so a refusal on any day changes nothing. */
export function branchScheduleRows(
    plan: BranchSchedulePlan,
    ctx: { bizId: string; staffId: string; homeBranchId: string; tz: string },
    rulesByDate: Map<string, LegacyRule>,
    branchHours: BranchHoursRow[],
) {
    return plan.dates.map((date) => {
        const saved = rulesByDate.get(date);
        return {
            ...(saved ? { id: saved.id } : {}),
            biz_id: ctx.bizId,
            staff_id: ctx.staffId,
            kind: 'date' as const,
            date_on: date,
            branch_id: ctx.homeBranchId,
            tz: ctx.tz,
            // A closed branch day becomes a day off, never invented hours.
            intervals: branchDayIntervals(branchHours, date) ?? [],
            breaks: [] as TimeRange[],
            is_active: true,
            priority: 0,
        };
    });
}

/** The values one saved day writes (a day off has no intervals). */
export function dayRuleValues(interval: TimeRange | null, branchId: string) {
    return { intervals: interval ? [interval] : [], breaks: [] as TimeRange[], branch_id: branchId, is_active: true };
}

/** The editor's starting state of a day (DayRow): saved rule, else branch hours, else 09:00–21:00. */
export function dayDraft(rule: LegacyRule | undefined, branchIntervals: TimeRange[] | undefined, homeBranchId: string) {
    const unsaved = rule === undefined;
    const savedDayOff = !unsaved && rule.intervals.length === 0;
    const branchClosed = unsaved && Array.isArray(branchIntervals) && branchIntervals.length === 0;
    let interval: TimeRange = { start: '09:00', end: '21:00' };
    if (!unsaved && rule.intervals[0]?.start && rule.intervals[0]?.end) interval = rule.intervals[0];
    else if (unsaved && branchIntervals && branchIntervals.length > 0) interval = branchIntervals[0];
    return { unsaved, dayOff: savedDayOff || branchClosed, interval, branchId: rule?.branch_id || homeBranchId };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(value: string): boolean {
    return TIME.test(value);
}

function shiftHour(value: string, hours: number): string {
    const [h, m] = value.split(':').map(Number);
    const total = (((h + hours) % 24) + 24) % 24;
    return `${String(total).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** A new start: the end moves an hour after it when it would no longer be later (SingleTimeRange). */
export function withStart(range: TimeRange, start: string): TimeRange {
    if (!isTime(start)) return range;
    const end = range.end && start >= range.end ? shiftHour(range.end, 1) : range.end;
    return { start, end: end || '21:00' };
}

/** A new end: the start moves an hour before it when it would no longer be earlier. */
export function withEnd(range: TimeRange, end: string): TimeRange {
    if (!isTime(end)) return range;
    const start = range.start && end <= range.start ? shiftHour(range.start, -1) : range.start;
    return { start: start || '09:00', end };
}
