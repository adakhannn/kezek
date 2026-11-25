'use client';

import { addDays, addWeeks, startOfWeek } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TimeRange } from './scheduleTypes';

import { useBusinessTimeZone } from '@/components/BusinessTimeZoneContext';
import { logError } from '@/lib/log';
import {
    branchDayIntervals,
    legacyScheduleWriteMessage,
    nextYmd,
    type BranchHoursRow,
} from '@/lib/scheduling/legacyDefaults';
import { supabase } from '@/lib/supabaseClient';

function getWeekDates(weekOffset: number): Date[] {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const targetWeekStart = addWeeks(weekStart, weekOffset);
    return Array.from({ length: 7 }, (_, index) => addDays(targetWeekStart, index));
}

const todayYmd = (tz: string) => formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');

type ScheduleRule = {
    id: string;
    date_on: string;
    intervals: TimeRange[];
    branch_id: string;
};

/** Days the "apply branch hours" action would write, decided when the manager clicks. */
export type BranchSchedulePlan = {
    dates: string[];
    /** Saved days among `dates` whose hours are replaced. */
    overwrite: number;
    /** Days kept because they are temporary transfers to another branch. */
    keptTransfers: number;
};

/**
 * Legacy (date-rule) schedule of one staff member for the current and the next week.
 * Viewing is read-only (FE-02): the editor no longer creates rules when it opens. Every write is
 * an explicit action whose result is checked, closed branch days stay days off, past days are
 * not written and temporary transfers are kept.
 */
export function useStaffScheduleRules({
    bizId,
    staffId,
    homeBranchId,
    branchHours,
    t,
    showError,
    showSuccess,
}: {
    bizId: string;
    staffId: string;
    homeBranchId: string;
    /** Home-branch hours read on the server; null when they could not be read. */
    branchHours: BranchHoursRow[] | null;
    t: (key: string, fallback: string) => string;
    showError: (message: string) => void;
    showSuccess: (message: string) => void;
}) {
    const tz = useBusinessTimeZone();
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [rules, setRules] = useState<ScheduleRule[]>([]);
    const loadSequence = useRef(0);

    const currentWeekDates = useMemo(() => getWeekDates(0), []);
    const nextWeekDates = useMemo(() => getWeekDates(1), []);
    const windowDates = useMemo(
        () => [...currentWeekDates, ...nextWeekDates].map((date) => formatInTimeZone(date, tz, 'yyyy-MM-dd')),
        [currentWeekDates, nextWeekDates, tz],
    );

    const load = useCallback(async (isActive: () => boolean = () => true) => {
        const sequence = ++loadSequence.current;
        const { data, error } = await supabase
            .from('staff_schedule_rules')
            .select('id, date_on, intervals, branch_id')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('kind', 'date')
            .eq('is_active', true)
            .gte('date_on', windowDates[0])
            .lte('date_on', windowDates[windowDates.length - 1])
            .order('date_on', { ascending: true })
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        // Unmounted, or a newer load (after a write) superseded this one.
        if (!isActive() || sequence !== loadSequence.current) return;
        if (error) {
            logError('StaffScheduleClient', 'Failed to load schedule rules', error);
            setStatus('error');
            return;
        }

        // The first row of a date is the one resolve_staff_day_legacy uses (priority, then newest).
        const winners = new Map<string, ScheduleRule>();
        for (const rule of data ?? []) {
            if (!rule.date_on || winners.has(rule.date_on)) continue;
            winners.set(rule.date_on, {
                id: rule.id,
                date_on: rule.date_on,
                intervals: (rule.intervals ?? []) as TimeRange[],
                branch_id: rule.branch_id || homeBranchId,
            });
        }
        setRules([...winners.values()]);
        setStatus('ready');
    }, [bizId, staffId, homeBranchId, windowDates]);

    useEffect(() => {
        let active = true;
        void load(() => active);
        return () => {
            active = false;
        };
    }, [load]);

    const rulesByDate = useMemo(() => {
        const map = new Map<string, { id: string; intervals: TimeRange[]; branch_id: string }>();
        for (const rule of rules) {
            map.set(rule.date_on, { id: rule.id, intervals: rule.intervals, branch_id: rule.branch_id });
        }
        return map;
    }, [rules]);

    function planBranchSchedule(): BranchSchedulePlan | null {
        if (branchHours === null) {
            showError(t('staff.schedule.branchHoursUnavailable', 'Не удалось загрузить часы филиала. Обновите страницу'));
            return null;
        }
        if (branchHours.length === 0) {
            showError(t('staff.schedule.branchHoursMissing', 'Часы филиала не настроены: задайте их в настройках филиала'));
            return null;
        }
        const today = todayYmd(tz);
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
        return plan;
    }

    async function applyBranchSchedule(plan: BranchSchedulePlan) {
        if (status !== 'ready' || !branchHours || branchHours.length === 0 || plan.dates.length === 0) return;
        setSaving(true);
        try {
            const rows = plan.dates.map((date) => {
                const saved = rulesByDate.get(date);
                return {
                    ...(saved ? { id: saved.id } : {}),
                    biz_id: bizId,
                    staff_id: staffId,
                    kind: 'date' as const,
                    date_on: date,
                    branch_id: homeBranchId,
                    tz,
                    // A closed branch day becomes a day off, never invented hours.
                    intervals: branchDayIntervals(branchHours, date) ?? [],
                    breaks: [],
                    is_active: true,
                    priority: 0,
                };
            });
            // One statement: a refusal on any day (RLS, guard, conflict) leaves every day unchanged.
            const { data, error } = await supabase
                .from('staff_schedule_rules')
                .upsert(rows, { onConflict: 'id', defaultToNull: false })
                .select('id');
            if (error) throw error;
            if ((data ?? []).length !== rows.length) throw Object.assign(new Error('SCHEDULE_PARTIAL_WRITE'), { code: 'PGRST116' });
            showSuccess(t('staff.schedule.branchApplied', 'Часы филиала применены: {count} дн.').replace('{count}', String(rows.length)));
            await load();
        } catch (error) {
            logError('StaffScheduleClient', 'Error applying branch schedule', error);
            showError(legacyScheduleWriteMessage(error, t));
        } finally {
            setSaving(false);
        }
    }

    async function saveDay(date: string, interval: TimeRange | null, branchId: string) {
        if (status !== 'ready') return;
        if (date < todayYmd(tz)) {
            showError(t('staff.schedule.pastDateLocked', 'Прошедшие дни не меняются'));
            return;
        }
        setSaving(true);
        try {
            const existing = rulesByDate.get(date);
            if (existing && existing.branch_id !== homeBranchId && existing.branch_id !== branchId) {
                // bookings_branch_guard re-checks the branch of a booking on every booking update, so a
                // day that has bookings at the transfer branch cannot be moved away from it. The window
                // covers the Bishkek day and the UTC date the guard uses.
                const { count, error } = await supabase
                    .from('bookings')
                    .select('id', { count: 'exact', head: true })
                    .eq('staff_id', staffId)
                    .eq('branch_id', existing.branch_id)
                    .gte('start_at', fromZonedTime(`${date}T00:00:00`, tz).toISOString())
                    .lt('start_at', `${nextYmd(date)}T00:00:00.000Z`);
                if (error) throw error;
                if ((count ?? 0) > 0) {
                    showError(t('staff.schedule.transferHasBookings', 'На этот день есть записи в филиале перевода: сначала перенесите или отмените их'));
                    return;
                }
            }

            const values = { intervals: interval ? [interval] : [], breaks: [], branch_id: branchId, is_active: true };
            // .single() turns "no row changed" (hidden by RLS or already gone) into PGRST116.
            const { error } = existing
                ? await supabase
                    .from('staff_schedule_rules')
                    .update(values)
                    .eq('id', existing.id)
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .select('id')
                    .single()
                : await supabase
                    .from('staff_schedule_rules')
                    .insert({ ...values, biz_id: bizId, staff_id: staffId, kind: 'date', date_on: date, tz, priority: 0 })
                    .select('id')
                    .single();
            if (error) throw error;
            showSuccess(t('staff.schedule.saved', 'Сохранено'));
            await load();
        } catch (error) {
            logError('StaffScheduleClient', 'Error saving schedule', error);
            showError(legacyScheduleWriteMessage(error, t));
        } finally {
            setSaving(false);
        }
    }

    return {
        status,
        saving,
        currentWeekDates,
        nextWeekDates,
        rulesByDate,
        planBranchSchedule,
        applyBranchSchedule,
        saveDay,
        reload: () => load(),
    };
}
