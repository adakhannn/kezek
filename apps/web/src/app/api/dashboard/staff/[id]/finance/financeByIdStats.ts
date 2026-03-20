import { formatInTimeZone } from 'date-fns-tz';

import { logError } from '@/lib/log';

export type FinanceByIdStats = {
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalLateMinutes: number;
    shiftsCount: number;
};

export type FinanceByIdAllShift = {
    shift_date: string;
    status: string;
    total_amount: number;
    master_share: number;
    salon_share: number;
    late_minutes: number;
};

type AllShiftRow = {
    shift_date: string | null;
    status: string | null;
    total_amount: number | null;
    master_share: number | null;
    salon_share: number | null;
    late_minutes: number | null;
};

type AdminLikeClient = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

type ShiftLike = {
    status?: string | null;
    opened_at?: string | null;
};

type LoadFinanceByIdStatsInput = {
    admin: AdminLikeClient;
    bizId: string;
    staffId: string;
    targetDate: Date;
    businessTz: string;
    shift: ShiftLike | null;
    hourlyRate: number | null;
};

function safeNumber(value: number | null | undefined): number {
    return typeof value === 'number' && !Number.isNaN(value) ? value : 0;
}

export async function loadFinanceByIdStats(
    input: LoadFinanceByIdStatsInput
): Promise<{
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
    stats: FinanceByIdStats;
    allShifts: FinanceByIdAllShift[];
}> {
    const { admin, bizId, staffId, targetDate, businessTz, shift, hourlyRate } = input;

    let currentHoursWorked: number | null = null;
    let currentGuaranteedAmount: number | null = null;

    if (shift?.status === 'open' && shift.opened_at && hourlyRate) {
        const openedAt = new Date(shift.opened_at);
        const nowDate = new Date();
        const diffMs = nowDate.getTime() - openedAt.getTime();
        currentHoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
        currentGuaranteedAmount = currentHoursWorked * hourlyRate;
    }

    const thirtyDaysAgo = new Date(targetDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const statsStart = formatInTimeZone(thirtyDaysAgo, businessTz, 'yyyy-MM-dd');

    const [recentShiftsResult, allShiftsResult] = await Promise.all([
        admin
            .from('staff_shifts')
            .select('total_amount, master_share, salon_share, late_minutes')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('status', 'closed')
            .gte('shift_date', statsStart)
            .order('shift_date', { ascending: false }),
        admin
            .from('staff_shifts')
            .select('shift_date, status, total_amount, master_share, salon_share, late_minutes')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .order('shift_date', { ascending: false }),
    ]);

    if (recentShiftsResult.error) {
        logError('StaffFinance', 'Error loading stats', recentShiftsResult.error);
    }

    if (allShiftsResult.error) {
        logError('StaffFinance', 'Error loading all shifts', allShiftsResult.error);
    }

    const stats: FinanceByIdStats = {
        totalAmount: 0,
        totalMaster: 0,
        totalSalon: 0,
        totalLateMinutes: 0,
        shiftsCount: 0,
    };

    for (const shiftRow of Array.isArray(recentShiftsResult.data) ? recentShiftsResult.data : []) {
        stats.totalAmount += safeNumber(shiftRow.total_amount);
        stats.totalMaster += safeNumber(shiftRow.master_share);
        stats.totalSalon += safeNumber(shiftRow.salon_share);
        stats.totalLateMinutes += safeNumber(shiftRow.late_minutes);
        stats.shiftsCount += 1;
    }

    const allShifts = (Array.isArray(allShiftsResult.data) ? allShiftsResult.data : []).map((shiftRow: AllShiftRow) => ({
        shift_date: typeof shiftRow.shift_date === 'string' ? shiftRow.shift_date : '',
        status: typeof shiftRow.status === 'string' ? shiftRow.status : 'closed',
        total_amount: safeNumber(shiftRow.total_amount),
        master_share: safeNumber(shiftRow.master_share),
        salon_share: safeNumber(shiftRow.salon_share),
        late_minutes: safeNumber(shiftRow.late_minutes),
    }));

    return {
        currentHoursWorked,
        currentGuaranteedAmount,
        stats,
        allShifts,
    };
}
