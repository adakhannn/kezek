import { formatInTimeZone } from 'date-fns-tz';

import type { Period } from './financeStatsParams';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';


type ShiftRow = {
    id: string;
    shift_date: string;
    status: string;
    [key: string]: unknown;
};

type AdminLikeClient = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: unknown) => {
                eq: (nestedColumn: string, nestedValue: unknown) => {
                    eq: (deepColumn: string, deepValue: unknown) => {
                        eq: (statusColumn: string, statusValue: unknown) => {
                            maybeSingle: () => Promise<{ data: unknown; error?: { message: string } | null }>;
                        };
                        gte: (gteColumn: string, gteValue: unknown) => {
                            lte: (lteColumn: string, lteValue: unknown) => {
                                order: (orderColumn: string, options: { ascending: boolean }) => Promise<{ data: unknown; error?: { message: string } | null }>;
                            };
                        };
                    };
                };
            };
        };
    };
};

type LoadFinanceStatsShiftsInput = {
    admin: AdminLikeClient;
    bizId: string;
    staffId: string;
    businessTz: string;
    period: Period;
    date: string;
    dateFrom: string;
    dateTo: string;
};

type LoadFinanceStatsShiftsResult = {
    today: string;
    finalShifts: ShiftRow[];
};

export async function loadFinanceStatsShifts(
    input: LoadFinanceStatsShiftsInput
): Promise<LoadFinanceStatsShiftsResult | Response> {
    const { admin, bizId, staffId, businessTz, period, date, dateFrom, dateTo } = input;
    const today = formatInTimeZone(new Date(), businessTz, 'yyyy-MM-dd');

    const { data: todayOpenShift } = await admin
        .from('staff_shifts')
        .select('*')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('shift_date', today)
        .eq('status', 'open')
        .maybeSingle();

    logDebug('StaffFinanceStats', 'Today open shift', { hasOpenShift: !!todayOpenShift });

    const { data: shifts, error: shiftsError } = await admin
        .from('staff_shifts')
        .select('*, staff:staff_id (hourly_rate, percent_master, percent_salon)')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .gte('shift_date', dateFrom)
        .lte('shift_date', dateTo)
        .order('shift_date', { ascending: false });

    if (shiftsError) {
        logError('StaffFinanceStats', 'Error loading shifts', shiftsError);
        return createErrorResponse('internal', shiftsError.message, undefined, 500);
    }

    logDebug('StaffFinanceStats', 'Found shifts', { count: shifts?.length || 0, shifts });
    if (shifts && shifts.length > 0) {
        logDebug('StaffFinanceStats', 'Shift dates', shifts.map((shift: ShiftRow) => ({
            date: shift.shift_date,
            status: shift.status,
        })));
    }

    let finalShifts = (shifts || []) as ShiftRow[];
    if (todayOpenShift) {
        const hasTodayShift = finalShifts.some((shift) => shift.id === todayOpenShift.id);
        if (period === 'day' && date === today && !hasTodayShift) {
            finalShifts = [todayOpenShift as ShiftRow, ...finalShifts];
            logDebug('StaffFinanceStats', 'Added today open shift to results');
        } else if (period !== 'day' && !hasTodayShift) {
            finalShifts = [todayOpenShift as ShiftRow, ...finalShifts];
            logDebug('StaffFinanceStats', 'Added today open shift to results for period view');
        }
    }

    return {
        today,
        finalShifts,
    };
}
