import { logError } from '@/lib/log';
import { dateAtTz } from '@/lib/time';

type SupabaseLikeClient = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: unknown) => {
                eq: (nestedColumn: string, nestedValue: unknown) => {
                    eq: (deepColumn: string, deepValue: unknown) => {
                        eq: (deeperColumn: string, deeperValue: unknown) => {
                            maybeSingle: () => Promise<{ data: unknown; error?: { message: string } | null }>;
                        };
                    };
                    maybeSingle: () => Promise<{ data: unknown; error?: { message: string } | null }>;
                };
            };
        };
    };
};

type ResolveOwnerShiftTimingInput = {
    supabase: SupabaseLikeClient;
    bizId: string;
    staffId: string;
    targetDate: Date;
    ymd: string;
    businessTz: string;
};

export async function resolveOwnerShiftTiming(input: ResolveOwnerShiftTimingInput) {
    const { supabase, bizId, staffId, targetDate, ymd, businessTz } = input;
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
                const sorted = [...intervals].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
                const first = sorted[0];
                if (first?.start) {
                    expectedStart = dateAtTz(ymd, first.start, businessTz);
                }
            }
        } catch (e) {
            logError('OwnerShiftOpen', 'Failed to parse date rule intervals', e);
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
                hasWorkingHours = true;
                const sorted = [...intervals].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
                const first = sorted[0];
                if (first?.start) {
                    expectedStart = dateAtTz(ymd, first.start, businessTz);
                }
            }
        } catch (e) {
            logError('OwnerShiftOpen', 'Failed to parse working hours intervals', e);
        }
    }

    const openedAt = new Date();
    let lateMinutes = 0;
    if (expectedStart) {
        const diffMs = openedAt.getTime() - expectedStart.getTime();
        if (diffMs > 0) {
            lateMinutes = Math.round(diffMs / 60000);
        }
    }

    return {
        openedAt,
        lateMinutes,
    };
}
