import { logDebug, logError } from '@/lib/log';
import { TZ, dateAtTz, formatDateInTz } from '@/lib/time';

type Result =
    | {
          ok: false;
          statusCode: 400 | 500;
          errorType: 'validation' | 'internal';
          message: string;
          details?: Record<string, unknown>;
      }
    | {
          ok: true;
          shift: Record<string, unknown>;
      };

export async function runDashboardStaffShiftOpen({
    req,
    supabase,
    admin,
    bizId,
    staffId,
    staff,
}: {
    req: Request;
    supabase: any;
    admin: any;
    bizId: string;
    staffId: string;
    staff: {
        branch_id: string | null;
    };
}): Promise<Result> {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
    const ymd = formatDateInTz(targetDate, TZ);

    if (staff.branch_id == null) {
        logDebug('OwnerShiftOpen', 'Staff has no branch_id', { staffId, bizId });
        return {
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message:
                'У сотрудника не указан филиал. Укажите филиал в карточке сотрудника и попробуйте снова.',
        };
    }

    const { data: existingShift, error: checkError } = await admin
        .from('staff_shifts')
        .select('id, status')
        .eq('staff_id', staffId)
        .eq('shift_date', ymd)
        .maybeSingle();

    if (checkError) {
        logError('OwnerShiftOpen', 'Error checking existing shift', checkError);
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: 'Не удалось проверить существующую смену',
        };
    }

    if (existingShift?.status === 'open') {
        logDebug('OwnerShiftOpen', 'Shift already open, returning existing shift', {
            shiftId: existingShift.id,
            staffId,
            ymd,
        });
        return {
            ok: true,
            shift: existingShift,
        };
    }

    const { expectedStart } = await resolveExpectedStart({
        supabase,
        bizId,
        staffId,
        ymd,
        targetDate,
    });

    const openedAt = new Date();
    const lateMinutes =
        expectedStart && openedAt.getTime() > expectedStart.getTime()
            ? Math.round((openedAt.getTime() - expectedStart.getTime()) / 60000)
            : 0;

    if (existingShift) {
        const { data: updatedShift, error: updateError } = await admin
            .from('staff_shifts')
            .update({
                status: 'open',
                opened_at: openedAt.toISOString(),
                closed_at: null,
                late_minutes: lateMinutes,
            })
            .eq('id', existingShift.id)
            .select()
            .single();

        if (updateError) {
            logError('OwnerShiftOpen', 'Error updating shift', updateError);
            return {
                ok: false,
                statusCode: 500,
                errorType: 'internal',
                message: 'Не удалось открыть смену',
            };
        }

        logDebug('OwnerShiftOpen', 'Shift reopened successfully', {
            shiftId: updatedShift.id,
            staffId,
            ymd,
        });

        return {
            ok: true,
            shift: updatedShift,
        };
    }

    const { data: newShift, error: createError } = await admin
        .from('staff_shifts')
        .insert({
            staff_id: staffId,
            biz_id: bizId,
            branch_id: staff.branch_id,
            shift_date: ymd,
            status: 'open',
            opened_at: openedAt.toISOString(),
            late_minutes: lateMinutes,
        })
        .select()
        .single();

    if (createError) {
        const errorPayload = {
            code: (createError as { code?: string })?.code,
            message: (createError as { message?: string })?.message,
            details: (createError as { details?: string })?.details,
            hint: (createError as { hint?: string })?.hint,
            staffId,
            bizId,
            branch_id: staff.branch_id,
            shift_date: ymd,
        };
        logError('OwnerShiftOpen', 'Error creating shift', errorPayload);
        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: (createError as { message?: string })?.message || 'Не удалось создать смену',
            details: errorPayload,
        };
    }

    logDebug('OwnerShiftOpen', 'Shift opened successfully', {
        shiftId: newShift.id,
        staffId,
        ymd,
    });

    return {
        ok: true,
        shift: newShift,
    };
}

async function resolveExpectedStart({
    supabase,
    bizId,
    staffId,
    ymd,
    targetDate,
}: {
    supabase: any;
    bizId: string;
    staffId: string;
    ymd: string;
    targetDate: Date;
}) {
    const dow = targetDate.getDay();
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
                    expectedStart = dateAtTz(ymd, first.start);
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
                    expectedStart = dateAtTz(ymd, first.start);
                }
            }
        } catch (error) {
            logError('OwnerShiftOpen', 'Failed to parse working hours intervals', error);
        }
    }

    return { expectedStart };
}

