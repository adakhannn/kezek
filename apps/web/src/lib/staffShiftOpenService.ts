import type { SupabaseClient } from '@supabase/supabase-js';

import { logDebug, logError, logWarn } from '@/lib/log';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { readScheduledDay } from '@/lib/scheduling/read';
import { TZ, dateAtTz, formatDateInTz, todayTz } from '@/lib/time';

type ShiftOpenContext = {
    supabase: SupabaseClient;
    staffId: string;
    bizId: string;
    branchId: string | null;
};

type ShiftOpenRpcResult = {
    ok: boolean;
    error?: string;
    action?: string;
    shift?: unknown;
};

type ShiftOpenFailure = {
    ok: false;
    status: 400 | 500;
    error: 'validation' | 'internal';
    message: string;
};

type ShiftOpenSuccess = {
    ok: true;
    status: 200;
    shift: unknown;
};

type ShiftOpenResult = ShiftOpenFailure | ShiftOpenSuccess;

export async function runOpenStaffShift({
    supabase,
    staffId,
    bizId,
    branchId,
    now = new Date(),
}: ShiftOpenContext & { now?: Date }): Promise<ShiftOpenResult> {
    const scheduled = explicitSchedulingEnabled() ? await readScheduledDay(staffId, bizId, now) : null;
    const ymd = scheduled?.ymd ?? formatDateInTz(now, TZ);

    const dayOffResult = scheduled
        ? scheduled.expectedStart
            ? { ok: true as const, expectedStart: scheduled.expectedStart }
            : { ok: false as const, status: 400 as const, error: 'validation' as const, message: 'На сегодня не назначены рабочие часы. Обратитесь к руководителю.' }
        : await ensureStaffCanWorkToday({ supabase, staffId, bizId, ymd });
    if (!dayOffResult.ok) {
        return dayOffResult;
    }

    const lateMinutes =
        dayOffResult.expectedStart && now.getTime() > dayOffResult.expectedStart.getTime()
            ? Math.round((now.getTime() - dayOffResult.expectedStart.getTime()) / 60000)
            : 0;

    const { data: rpcResult, error: rpcError } = await supabase.rpc('open_staff_shift_safe', {
        p_staff_id: staffId,
        p_biz_id: bizId,
        p_branch_id: scheduled?.day.branch_id ?? branchId,
        p_shift_date: ymd,
        p_opened_at: now.toISOString(),
        p_expected_start: dayOffResult.expectedStart ? dayOffResult.expectedStart.toISOString() : null,
        p_late_minutes: lateMinutes,
    });

    if (rpcError) {
        logError('StaffShiftOpen', 'Error calling open_staff_shift_safe RPC', rpcError);
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: rpcError.message || 'Не удалось открыть смену',
        };
    }

    const typedResult = rpcResult as ShiftOpenRpcResult | null;
    if (!typedResult || !typedResult.ok) {
        const errorMessage = typedResult?.error || 'Не удалось открыть смену';
        logError('StaffShiftOpen', 'RPC returned error', { error: errorMessage, result: rpcResult });
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: errorMessage,
        };
    }

    if (!typedResult.shift) {
        logError('StaffShiftOpen', 'RPC returned ok but no shift data', rpcResult);
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'Не удалось получить данные смены',
        };
    }

    logDebug('StaffShiftOpen', 'Shift opened successfully', {
        action: typedResult.action,
        shiftId: (typedResult.shift as { id?: string })?.id,
    });

    return {
        ok: true,
        status: 200,
        shift: typedResult.shift,
    };
}

async function ensureStaffCanWorkToday({
    supabase,
    staffId,
    bizId,
    ymd,
}: {
    supabase: SupabaseClient;
    staffId: string;
    bizId: string;
    ymd: string;
}): Promise<{ ok: true; expectedStart: Date | null } | ShiftOpenFailure> {
    const { data: timeOffs, error: timeOffError } = await supabase
        .from('staff_time_off')
        .select('id, date_from, date_to')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .is('cancelled_at', null)
        .lte('date_from', ymd)
        .gte('date_to', ymd);

    if (timeOffError) {
        logWarn('StaffShiftOpen', 'Cannot load staff_time_off', timeOffError);
    }

    if (timeOffs && timeOffs.length > 0) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Сегодня у вас выходной день. Нельзя открыть смену.',
        };
    }

    const expectedStart = await resolveExpectedStart({ supabase, staffId, bizId, ymd });
    if (!expectedStart) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Сегодня у вас выходной день. Нельзя открыть смену.',
        };
    }

    return { ok: true, expectedStart };
}

async function resolveExpectedStart({
    supabase,
    staffId,
    bizId,
    ymd,
}: {
    supabase: SupabaseClient;
    staffId: string;
    bizId: string;
    ymd: string;
}): Promise<Date | null> {
    const { data: dateRule, error: dateRuleError } = await supabase
        .from('staff_schedule_rules')
        .select('intervals, is_active')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('kind', 'date')
        .eq('date_on', ymd)
        .eq('is_active', true)
        .maybeSingle();

    if (dateRuleError) {
        logWarn('StaffShiftOpen', 'Cannot load staff_schedule_rules', dateRuleError);
    }

    const expectedStartFromDateRule = parseExpectedStart(ymd, dateRule?.intervals);
    if (dateRule?.is_active && expectedStartFromDateRule) {
        return expectedStartFromDateRule;
    }

    const weeklyDay = todayTz().getDay();
    const { data: workingHoursRow, error: workingHoursError } = await supabase
        .from('working_hours')
        .select('intervals')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('day_of_week', weeklyDay)
        .maybeSingle();

    if (workingHoursError) {
        logWarn('StaffShiftOpen', 'Cannot load working_hours', workingHoursError);
    }

    return parseExpectedStart(ymd, workingHoursRow?.intervals);
}

function parseExpectedStart(ymd: string, rawIntervals: unknown): Date | null {
    try {
        const intervals = (rawIntervals ?? []) as { start: string; end: string }[];
        if (!Array.isArray(intervals) || intervals.length === 0) {
            return null;
        }

        const firstInterval = [...intervals].sort((left, right) =>
            (left.start ?? '').localeCompare(right.start ?? '')
        )[0];

        return firstInterval?.start ? dateAtTz(ymd, firstInterval.start) : null;
    } catch (error) {
        logWarn('StaffShiftOpen', 'Failed to parse schedule intervals', error);
        return null;
    }
}
