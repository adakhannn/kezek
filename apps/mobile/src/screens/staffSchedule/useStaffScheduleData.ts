import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import { useCurrentStaff } from '../../hooks/useCurrentStaff';
import { useNow } from '../../hooks/useNow';
import { apiRequest } from '../../lib/api';
import { STAFF_ID_HEADER } from '../../lib/staffSelectionStorage';
import { supabase } from '../../lib/supabase';
import { addDaysYmd, businessTodayYmd, businessWeekYmds } from '../../utils/businessWeek';

export type TimeRange = { start: string; end: string };

/** One business day of the master's schedule. */
export type ScheduleDayView = {
    date: string;
    kind: 'working' | 'off' | 'absence' | 'unconfigured';
    intervals: TimeRange[];
    breaks: TimeRange[];
    branchId: string | null;
};

/** The explicit model's day (GET /api/staff/me/schedule, apps/web/src/lib/scheduling/model.ts). */
type EffectiveDay = {
    date: string;
    intervals: TimeRange[];
    breaks: TimeRange[];
    branch_id: string | null;
    source: 'legacy' | 'week' | 'day' | 'absence' | 'unconfigured';
};

function statusOf(error: unknown): number | undefined {
    return error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : undefined;
}

function ranges(value: unknown): TimeRange[] {
    return Array.isArray(value)
        ? value.filter((range): range is TimeRange => !!range && typeof range.start === 'string' && typeof range.end === 'string')
        : [];
}

export function dayFromEffective(day: EffectiveDay): ScheduleDayView {
    const intervals = ranges(day.intervals);
    const kind = day.source === 'unconfigured' ? 'unconfigured'
        : day.source === 'absence' ? 'absence'
            : intervals.length > 0 ? 'working' : 'off';
    return { date: day.date, kind, intervals, breaks: ranges(day.breaks), branchId: day.branch_id ?? null };
}

/**
 * The schedule days from `from` to `to` (S3). The explicit model's endpoint first, with the
 * master's Bearer token and card; while that model is off on the server (503) the dated rules
 * the website's ViewSchedule reads: a rule with no intervals is a day off, no rule — not set.
 */
export async function loadStaffSchedule(staffId: string, bizId: string, from: string, to: string): Promise<Map<string, ScheduleDayView>> {
    try {
        const response = await apiRequest<{ ok?: boolean; data?: { days?: EffectiveDay[] } }>(
            `/api/staff/me/schedule?from=${from}&to=${to}`,
            { headers: { [STAFF_ID_HEADER]: staffId } },
        );
        if (!response?.ok || !Array.isArray(response.data?.days)) throw new Error('Unexpected schedule response');
        return new Map(response.data.days.map((day) => [day.date, dayFromEffective(day)]));
    } catch (error) {
        if (statusOf(error) !== 503) throw error;
    }

    const { data, error } = await supabase
        .from('staff_schedule_rules')
        .select('id, date_on, intervals, branch_id')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('kind', 'date')
        .eq('is_active', true)
        .gte('date_on', from)
        .lt('date_on', addDaysYmd(to, 1))
        .order('date_on', { ascending: true });
    if (error) throw error;
    const days = new Map<string, ScheduleDayView>();
    for (const rule of (data ?? []) as { date_on: string; intervals: unknown; branch_id: string | null }[]) {
        const intervals = ranges(rule.intervals);
        days.set(rule.date_on, { date: rule.date_on, kind: intervals.length ? 'working' : 'off', intervals, breaks: [], branchId: rule.branch_id ?? null });
    }
    // Absences the manager set (RLS hides staff_time_off from the master): the shift screen already
    // calls such a day off, so the schedule says so too. An older server without the route: skip.
    try {
        const absences = await apiRequest<{ ok?: boolean; data?: { items?: { date_from: string; date_to: string }[] } }>(
            `/api/staff/me/time-off?from=${from}&to=${to}`,
            { headers: { [STAFF_ID_HEADER]: staffId } },
        );
        for (const item of absences?.data?.items ?? []) {
            for (let ymd = item.date_from < from ? from : item.date_from; ymd <= item.date_to && ymd <= to; ymd = addDaysYmd(ymd, 1)) {
                days.set(ymd, { date: ymd, kind: 'absence', intervals: [], breaks: [], branchId: null });
            }
        }
    } catch {
        // The schedule still shows the dated rules.
    }
    return days;
}

export function useStaffScheduleData() {
    const currentStaff = useCurrentStaff();
    const staff = currentStaff.staffInfo;
    const [refreshing, setRefreshing] = useState(false);
    const tz = resolveBusinessTimeZone(staff?.business?.tz);
    const { now } = useNow();
    // Weeks follow the business day, not the phone's (ARCH-11).
    const weeks = [businessWeekYmds(0, tz, now), businessWeekYmds(1, tz, now)];
    const from = weeks[0][0];
    const to = weeks[1][6];

    const scheduleQuery = useQuery({
        queryKey: ['staff-schedule', staff?.id, from, to],
        queryFn: () => (staff ? loadStaffSchedule(staff.id, staff.biz_id, from, to) : Promise.resolve(new Map<string, ScheduleDayView>())),
        enabled: !!staff,
    });
    const branchesQuery = useQuery({
        queryKey: ['staff-schedule-branches', staff?.biz_id],
        queryFn: async () => {
            if (!staff) return new Map<string, string>();
            const { data, error } = await supabase.from('branches').select('id, name').eq('biz_id', staff.biz_id);
            if (error) throw error;
            return new Map(((data ?? []) as { id: string; name: string }[]).map((branch) => [branch.id, branch.name]));
        },
        enabled: !!staff,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([scheduleQuery.refetch(), branchesQuery.refetch()]);
        } finally {
            setRefreshing(false);
        }
    };

    return {
        staff,
        needsSelection: currentStaff.needsSelection,
        staffLoading: currentStaff.isLoading,
        staffError: currentStaff.error,
        weeks,
        today: businessTodayYmd(tz, now),
        days: scheduleQuery.data,
        branchNames: branchesQuery.data ?? new Map<string, string>(),
        isLoading: scheduleQuery.isLoading,
        error: scheduleQuery.error as Error | null,
        refreshing,
        onRefresh,
    };
}
