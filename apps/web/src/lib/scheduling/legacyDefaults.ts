// Shared rules of the legacy (date-rule) staff schedule, used while SCHEDULE_V2_ENABLED is off
// (FE-02): the editor, staff creation and the staff's own view must agree on what a day without a
// saved rule means and must never invent working hours for a closed branch day.

export type LegacyTimeRange = { start: string; end: string };
export type BranchHoursRow = { day_of_week: number; intervals: LegacyTimeRange[] | null };

/** Hours for new staff when their branch has no working hours at all (documented default). */
export const LEGACY_DEFAULT_INTERVAL: LegacyTimeRange = { start: '09:00', end: '21:00' };

/** Day of week (0 = Sunday) of a calendar date, independent of the runtime time zone. */
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
 * branch is closed that weekday. Legacy saves store only open weekdays; replace_branch_schedule
 * stores all seven with [] for a closed day; both mean "closed" for a missing or empty weekday.
 */
export function branchDayIntervals(rows: BranchHoursRow[], ymd: string): LegacyTimeRange[] | undefined {
    if (rows.length === 0) return undefined;
    const intervals = rows.find((row) => row.day_of_week === weekdayOf(ymd))?.intervals;
    if (!Array.isArray(intervals)) return [];
    return intervals.filter((range) => Boolean(range?.start && range?.end && range.start < range.end));
}

/** User-facing text for a failed legacy schedule write. */
export function legacyScheduleWriteMessage(error: unknown, t: (key: string, fallback: string) => string): string {
    const { code, message = '' } = (error ?? {}) as { code?: string; message?: string };
    if (message.includes('SCHEDULE_USE_PUBLICATION_EDITOR')) {
        return t('staff.schedule.useNewEditor', 'Сотрудник уже работает по новой модели расписаний: здесь его график не меняется');
    }
    if (code === '42501' || /row-level security/i.test(message)) {
        return t('staff.schedule.noPermission', 'Недостаточно прав для изменения расписания');
    }
    if (code === '23505') {
        return t('staff.schedule.staleConflict', 'Этот день уже сохранил другой пользователь. Обновите страницу');
    }
    if (code === 'PGRST116') {
        return t('staff.schedule.notApplied', 'Изменение не применено: день изменён или недоступен. Обновите страницу');
    }
    return t('staff.schedule.saveError', 'Ошибка при сохранении расписания');
}
