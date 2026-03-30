'use client';

import { addDays, addWeeks, startOfWeek } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import type { TimeRange } from './scheduleTypes';

import { logError } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

function getWeekDates(weekOffset: number): Date[] {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const targetWeekStart = addWeeks(weekStart, weekOffset);
    return Array.from({ length: 7 }, (_, index) => addDays(targetWeekStart, index));
}

type ScheduleRule = {
    id: string;
    date_on: string;
    intervals: TimeRange[];
    branch_id: string;
};

export function useStaffScheduleRules({
    bizId,
    staffId,
    homeBranchId,
    t,
    showError,
}: {
    bizId: string;
    staffId: string;
    homeBranchId: string;
    t: (key: string, fallback: string) => string;
    showError: (message: string) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [rules, setRules] = useState<ScheduleRule[]>([]);

    const currentWeekDates = useMemo(() => getWeekDates(0), []);
    const nextWeekDates = useMemo(() => getWeekDates(1), []);

    useEffect(() => {
        let ignore = false;

        (async () => {
            const weekStart = formatInTimeZone(currentWeekDates[0], TZ, 'yyyy-MM-dd');
            const weekEnd = formatInTimeZone(addDays(nextWeekDates[6], 1), TZ, 'yyyy-MM-dd');

            const { data } = await supabase
                .from('staff_schedule_rules')
                .select('id, date_on, intervals, branch_id')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('is_active', true)
                .gte('date_on', weekStart)
                .lt('date_on', weekEnd)
                .order('date_on', { ascending: true });

            if (ignore) return;

            const loadedRules = (data ?? []).map((rule) => ({
                id: rule.id,
                date_on: rule.date_on,
                intervals: (rule.intervals ?? []) as TimeRange[],
                branch_id: rule.branch_id || homeBranchId,
            }));
            setRules(loadedRules);

            const allDates = [
                ...currentWeekDates.map((date) => formatInTimeZone(date, TZ, 'yyyy-MM-dd')),
                ...nextWeekDates.map((date) => formatInTimeZone(date, TZ, 'yyyy-MM-dd')),
            ];
            const existingDates = new Set(loadedRules.map((rule) => rule.date_on));
            const missingDates = allDates.filter((date) => !existingDates.has(date));

            if (missingDates.length > 0) {
                const { data: branchSchedule } = await supabase
                    .from('branch_working_hours')
                    .select('day_of_week, intervals')
                    .eq('biz_id', bizId)
                    .eq('branch_id', homeBranchId);

                const branchScheduleMap = new Map<number, TimeRange[]>();
                (branchSchedule || []).forEach((item) => {
                    const intervals = (item.intervals || []) as TimeRange[];
                    if (intervals.length > 0) {
                        branchScheduleMap.set(item.day_of_week, intervals);
                    }
                });

                const inserts = missingDates.map((date) => {
                    const dateObject = new Date(`${date}T12:00:00`);
                    const dayOfWeek = dateObject.getDay();
                    const branchIntervals = branchScheduleMap.get(dayOfWeek);
                    const defaultInterval: TimeRange = branchIntervals && branchIntervals.length > 0
                        ? branchIntervals[0]
                        : { start: '09:00', end: '21:00' };

                    return {
                        biz_id: bizId,
                        staff_id: staffId,
                        kind: 'date' as const,
                        date_on: date,
                        branch_id: homeBranchId,
                        tz: TZ,
                        intervals: branchIntervals && branchIntervals.length > 0 ? branchIntervals : [defaultInterval],
                        breaks: [],
                        is_active: true,
                        priority: 0,
                    };
                });

                await supabase.from('staff_schedule_rules').insert(inserts);
                await reloadRules(weekStart, weekEnd, homeBranchId, setRules, bizId, staffId);
            }
        })();

        return () => {
            ignore = true;
        };
    }, [bizId, staffId, homeBranchId, currentWeekDates, nextWeekDates]);

    const rulesByDate = useMemo(() => {
        const map = new Map<string, { intervals: TimeRange[]; branch_id: string }>();
        for (const rule of rules) {
            map.set(rule.date_on, { intervals: rule.intervals, branch_id: rule.branch_id });
        }
        return map;
    }, [rules]);

    async function applyBranchSchedule() {
        setSaving(true);
        try {
            const { data: branchSchedule } = await supabase
                .from('branch_working_hours')
                .select('day_of_week, intervals')
                .eq('biz_id', bizId)
                .eq('branch_id', homeBranchId);

            const branchScheduleMap = new Map<number, TimeRange[]>();
            (branchSchedule || []).forEach((item) => {
                const intervals = (item.intervals || []) as TimeRange[];
                if (intervals.length > 0) {
                    branchScheduleMap.set(item.day_of_week, intervals);
                }
            });

            const allDates = [
                ...currentWeekDates.map((date) => formatInTimeZone(date, TZ, 'yyyy-MM-dd')),
                ...nextWeekDates.map((date) => formatInTimeZone(date, TZ, 'yyyy-MM-dd')),
            ];

            const defaultInterval: TimeRange = { start: '09:00', end: '21:00' };

            for (const date of allDates) {
                const dateObject = new Date(`${date}T12:00:00`);
                const dayOfWeek = dateObject.getDay();
                const branchIntervals = branchScheduleMap.get(dayOfWeek);
                const intervals = branchIntervals && branchIntervals.length > 0 ? branchIntervals : [defaultInterval];
                const existing = rules.find((rule) => rule.date_on === date);

                if (existing?.id) {
                    await supabase
                        .from('staff_schedule_rules')
                        .update({
                            intervals,
                            breaks: [],
                            branch_id: homeBranchId,
                            is_active: true,
                        })
                        .eq('id', existing.id)
                        .eq('biz_id', bizId)
                        .eq('staff_id', staffId);
                } else {
                    await supabase.from('staff_schedule_rules').insert({
                        biz_id: bizId,
                        staff_id: staffId,
                        kind: 'date',
                        date_on: date,
                        branch_id: homeBranchId,
                        tz: TZ,
                        intervals,
                        breaks: [],
                        is_active: true,
                        priority: 0,
                    });
                }
            }

            const weekStart = formatInTimeZone(currentWeekDates[0], TZ, 'yyyy-MM-dd');
            const weekEnd = formatInTimeZone(addDays(nextWeekDates[6], 1), TZ, 'yyyy-MM-dd');
            await reloadRules(weekStart, weekEnd, homeBranchId, setRules, bizId, staffId);
        } catch (error) {
            logError('StaffScheduleClient', 'Error applying branch schedule', error);
            showError(
                t('staff.schedule.applyBranchError', 'Ошибка при применении расписания филиала:') +
                    ' ' +
                    (error instanceof Error ? error.message : String(error)),
            );
        } finally {
            setSaving(false);
        }
    }

    async function saveDay(date: string, interval: TimeRange | null, branchId: string) {
        setSaving(true);
        try {
            const existing = rules.find((rule) => rule.date_on === date);
            const intervalsToSave = interval ? [interval] : [];
            const isTemporaryTransfer = branchId !== homeBranchId;

            if (existing?.id) {
                await supabase
                    .from('staff_schedule_rules')
                    .update({
                        intervals: intervalsToSave,
                        breaks: [],
                        branch_id: branchId,
                        is_active: true,
                    })
                    .eq('id', existing.id)
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId);

                if (isTemporaryTransfer) {
                    const { data: existingAssign } = await supabase
                        .from('staff_branch_assignments')
                        .select('id')
                        .eq('biz_id', bizId)
                        .eq('staff_id', staffId)
                        .eq('branch_id', branchId)
                        .eq('valid_from', date)
                        .eq('valid_to', date)
                        .maybeSingle();

                    if (!existingAssign) {
                        await supabase.from('staff_branch_assignments').insert({
                            biz_id: bizId,
                            staff_id: staffId,
                            branch_id: branchId,
                            valid_from: date,
                            valid_to: date,
                        });
                    }
                } else if (existing.branch_id !== homeBranchId) {
                    await supabase
                        .from('staff_branch_assignments')
                        .delete()
                        .eq('biz_id', bizId)
                        .eq('staff_id', staffId)
                        .eq('branch_id', existing.branch_id)
                        .eq('valid_from', date)
                        .eq('valid_to', date);
                }
            } else {
                await supabase.from('staff_schedule_rules').insert({
                    biz_id: bizId,
                    staff_id: staffId,
                    kind: 'date',
                    date_on: date,
                    branch_id: branchId,
                    tz: TZ,
                    intervals: intervalsToSave,
                    breaks: [],
                    is_active: true,
                    priority: 0,
                });

                if (isTemporaryTransfer) {
                    await supabase.from('staff_branch_assignments').insert({
                        biz_id: bizId,
                        staff_id: staffId,
                        branch_id: branchId,
                        valid_from: date,
                        valid_to: date,
                    });
                }
            }

            const weekStart = formatInTimeZone(currentWeekDates[0], TZ, 'yyyy-MM-dd');
            const weekEnd = formatInTimeZone(addDays(nextWeekDates[6], 1), TZ, 'yyyy-MM-dd');
            await reloadRules(weekStart, weekEnd, homeBranchId, setRules, bizId, staffId);
        } catch (error) {
            logError('StaffScheduleClient', 'Error saving schedule', error);
            showError(t('staff.schedule.saveError', 'Ошибка при сохранении расписания'));
        } finally {
            setSaving(false);
        }
    }

    return {
        saving,
        currentWeekDates,
        nextWeekDates,
        rulesByDate,
        applyBranchSchedule,
        saveDay,
    };
}

async function reloadRules(
    weekStart: string,
    weekEnd: string,
    homeBranchId: string,
    setRules: (rules: ScheduleRule[]) => void,
    bizId: string,
    staffId: string,
) {
    const { data } = await supabase
        .from('staff_schedule_rules')
        .select('id, date_on, intervals, branch_id')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('kind', 'date')
        .eq('is_active', true)
        .gte('date_on', weekStart)
        .lt('date_on', weekEnd)
        .order('date_on', { ascending: true });

    setRules(
        (data ?? []).map((rule) => ({
            id: rule.id,
            date_on: rule.date_on,
            intervals: (rule.intervals ?? []) as TimeRange[],
            branch_id: rule.branch_id || homeBranchId,
        })),
    );
}
