import { formatInTimeZone } from 'date-fns-tz';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';

type AdminLikeClient = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

type SupabaseLikeClient = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

type ResolveFinanceByIdShiftContextInput = {
    supabase: SupabaseLikeClient;
    admin: AdminLikeClient;
    bizId: string;
    staffId: string;
    targetDate: Date;
    businessTz: string;
};

export async function resolveFinanceByIdShiftContext(
    input: ResolveFinanceByIdShiftContextInput
): Promise<{ ymd: string; isDayOff: boolean; shift: Record<string, unknown> | null } | Response> {
    const { supabase, admin, bizId, staffId, targetDate, businessTz } = input;
    const ymd = formatInTimeZone(targetDate, businessTz, 'yyyy-MM-dd');

    let isDayOff = false;
    const today = formatInTimeZone(new Date(), businessTz, 'yyyy-MM-dd');
    if (ymd === today) {
        const { data: timeOffs } = await supabase
            .from('staff_time_off')
            .select('id')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .lte('date_from', ymd)
            .gte('date_to', ymd);

        if (Array.isArray(timeOffs) && timeOffs.length > 0) {
            isDayOff = true;
        } else {
            const { data: dateRule } = await supabase
                .from('staff_schedule_rules')
                .select('intervals')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('date_on', ymd)
                .eq('is_active', true)
                .maybeSingle();

            if (dateRule && Array.isArray(dateRule.intervals) && dateRule.intervals.length === 0) {
                isDayOff = true;
            }
        }
    }

    const { data: shift, error: shiftError } = await admin
        .from('staff_shifts')
        .select('*')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('shift_date', ymd)
        .maybeSingle();

    if (shiftError) {
        logError('StaffFinance', 'Error loading shift', shiftError);
        return createErrorResponse('internal', shiftError.message, undefined, 500);
    }

    return {
        ymd,
        isDayOff,
        shift: (shift as Record<string, unknown> | null) ?? null,
    };
}
