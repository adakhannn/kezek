import type { FinanceByIdBooking, FinanceByIdService } from './financeByIdRelatedData';
import type { FinanceByIdShiftItemRow } from './financeByIdShiftItems';
import type { FinanceByIdAllShift, FinanceByIdStats } from './financeByIdStats';

type ShiftLike = {
    id: string;
    shift_date: string;
    opened_at?: string | null;
    closed_at?: string | null;
    expected_start?: string | null;
    late_minutes?: number | null;
    status: 'open' | 'closed';
    total_amount?: number | null;
    consumables_amount?: number | null;
    master_share?: number | null;
    salon_share?: number | null;
    hours_worked?: number | null;
    guaranteed_amount?: number | null;
    topup_amount?: number | null;
};

type BuildFinanceByIdResponseInput = {
    shift: ShiftLike | null;
    items: FinanceByIdShiftItemRow[];
    bookings: FinanceByIdBooking[];
    services: FinanceByIdService[];
    allShifts: FinanceByIdAllShift[];
    staffPercentMaster: number;
    staffPercentSalon: number;
    hourlyRate: number | null;
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
    isDayOff: boolean;
    stats: FinanceByIdStats;
};

function safeNumber(value: number | null | undefined): number {
    return typeof value === 'number' && !Number.isNaN(value) ? value : 0;
}

function safeOptionalNumber(value: number | null | undefined): number | undefined {
    return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}

export function buildFinanceByIdResponse(input: BuildFinanceByIdResponseInput) {
    const {
        shift,
        items,
        bookings,
        services,
        allShifts,
        staffPercentMaster,
        staffPercentSalon,
        hourlyRate,
        currentHoursWorked,
        currentGuaranteedAmount,
        isDayOff,
        stats,
    } = input;

    return {
        today: shift
            ? {
                  exists: true,
                  status: shift.status,
                  shift: {
                      id: shift.id,
                      shift_date: shift.shift_date,
                      opened_at: shift.opened_at ?? null,
                      closed_at: shift.closed_at ?? null,
                      expected_start: shift.expected_start ?? null,
                      late_minutes: safeNumber(shift.late_minutes),
                      status: shift.status,
                      total_amount: safeNumber(shift.total_amount),
                      consumables_amount: safeNumber(shift.consumables_amount),
                      master_share: safeNumber(shift.master_share),
                      salon_share: safeNumber(shift.salon_share),
                      percent_master: staffPercentMaster,
                      percent_salon: staffPercentSalon,
                      hours_worked:
                          typeof shift.hours_worked === 'number' && !Number.isNaN(shift.hours_worked)
                              ? shift.hours_worked
                              : null,
                      hourly_rate: hourlyRate,
                      guaranteed_amount: safeOptionalNumber(shift.guaranteed_amount),
                      topup_amount: safeOptionalNumber(shift.topup_amount),
                  },
                  items: Array.isArray(items) ? items : [],
              }
            : {
                  exists: false,
                  status: 'none' as const,
                  shift: null,
                  items: [],
              },
        bookings,
        services,
        allShifts,
        staffPercentMaster,
        staffPercentSalon,
        hourlyRate,
        currentHoursWorked,
        currentGuaranteedAmount,
        isDayOff,
        stats,
    };
}
