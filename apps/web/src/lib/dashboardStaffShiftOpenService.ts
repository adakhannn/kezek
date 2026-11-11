import type { SupabaseClient } from '@supabase/supabase-js';

import { isFinanceDate, readFinanceCalendar } from '@/lib/finance/calendar';
import { logError } from '@/lib/log';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { readScheduledDay } from '@/lib/scheduling/read';
import { financeCommandFailure } from '@/lib/staffShift/financeCommand';
import { dateAtTz } from '@/lib/time';

type Result = { ok: true; shift: Record<string, unknown> } | { ok: false; statusCode: number; errorType: 'validation' | 'forbidden' | 'internal'; message: string; details?: Record<string, unknown> };
export async function runDashboardStaffShiftOpen({ req, supabase, admin, bizId, staffId, staff }: {
    req: Request; supabase: SupabaseClient; admin: SupabaseClient; bizId: string; staffId: string; staff: { branch_id: string | null };
}): Promise<Result> {
    const dateParam = new URL(req.url).searchParams.get('date');
    if (dateParam && !isFinanceDate(dateParam)) return { ok: false, statusCode: 400, errorType: 'validation', message: 'Неверная дата смены.' };
    const calendar = await readFinanceCalendar(supabase, bizId, staffId, dateParam ?? undefined);
    const ymd = calendar.date;
    if (ymd > calendar.todayDate) return { ok: false, statusCode: 409, errorType: 'validation', message: 'Будущую смену открыть нельзя.' };
    const { data: existing, error: readError } = await admin.from('staff_shifts').select('id,status')
        .eq('staff_id', staffId).eq('biz_id', bizId).eq('shift_date', ymd).maybeSingle();
    if (readError) return financeCommandFailure(readError);
    if (!existing && ymd !== calendar.todayDate) return { ok: false, statusCode: 409, errorType: 'validation', message: 'За прошлый день можно повторно открыть только существующую смену с сохранённым временем открытия.' };
    if (!existing && !staff.branch_id) return { ok: false, statusCode: 400, errorType: 'validation', message: 'У сотрудника не указан филиал.' };
    const scheduled = !existing && explicitSchedulingEnabled() ? await readScheduledDay(staffId, bizId, ymd) : null;
    if (scheduled && !scheduled.expectedStart) return { ok: false, statusCode: 400, errorType: 'validation', message: 'На этот день не назначены рабочие часы. Сначала настройте график сотрудника.' };
    const { expectedStart } = existing ? { expectedStart: null } : scheduled ?? await resolveExpectedStart({ supabase, bizId, staffId, ymd, timezone: calendar.timezone });
    const now = new Date();
    const { data, error } = await supabase.rpc('open_staff_shift_safe', {
        p_staff_id: staffId, p_biz_id: bizId, p_branch_id: scheduled?.day.branch_id ?? staff.branch_id,
        p_shift_date: ymd, p_opened_at: now.toISOString(), p_expected_start: expectedStart?.toISOString() ?? null,
        p_late_minutes: expectedStart ? Math.max(0, Math.round((now.getTime() - expectedStart.getTime()) / 60000)) : 0,
    });
    if (error) return financeCommandFailure(error);
    if (!data?.ok || !data.shift) return financeCommandFailure({ message: 'Unconfirmed shift open' });
    return { ok: true, shift: data.shift };
}

async function resolveExpectedStart({
    supabase,
    bizId,
    staffId,
    ymd,
    timezone,
}: {
    supabase: SupabaseClient;
    bizId: string;
    staffId: string;
    ymd: string;
    timezone: string;
}) {
    const dow = new Date(ymd + 'T12:00:00Z').getUTCDay();
    let expectedStart: Date | null = null;
    let hasWorkingHours = false;

    const { data: dateRule } = await supabase
        .from('staff_schedule_rules')
        .select('intervals, is_active')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('kind', 'date')
        .eq('date_on', ymd)
        .eq('is_active', true)
        .maybeSingle();

    if (dateRule && dateRule.is_active) {
        try {
            const intervals = (dateRule.intervals ?? []) as { start: string; end: string }[];
            if (Array.isArray(intervals) && intervals.length > 0) {
                hasWorkingHours = true;
                const first = [...intervals].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))[0];
                if (first?.start) {
                    expectedStart = dateAtTz(ymd, first.start, timezone);
                }
            }
        } catch (error) {
            logError('OwnerShiftOpen', 'Failed to parse date rule intervals', error);
        }
    }

    if (!hasWorkingHours) {
        const { data: whRow } = await supabase
            .from('working_hours')
            .select('intervals')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('day_of_week', dow)
            .maybeSingle();

        try {
            const intervals = (whRow?.intervals ?? []) as { start: string; end: string }[];
            if (Array.isArray(intervals) && intervals.length > 0) {
                const first = [...intervals].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))[0];
                if (first?.start) {
                    expectedStart = dateAtTz(ymd, first.start, timezone);
                }
            }
        } catch (error) {
            logError('OwnerShiftOpen', 'Failed to parse working hours intervals', error);
        }
    }

    return { expectedStart };
}

