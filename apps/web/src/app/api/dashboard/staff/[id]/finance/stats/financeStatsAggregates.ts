import type { FinanceStatsShiftItem } from './financeStatsShiftItems';

type ShiftRow = {
    id: string;
    status: string;
    percent_master?: number | null;
    percent_salon?: number | null;
    hourly_rate?: number | null;
    opened_at?: string | null;
    staff?: {
        hourly_rate?: number | null;
    } | null;
};

export function getShiftStatusGroups(shifts: ShiftRow[]) {
    const closedShifts = shifts.filter((shift) => shift.status === 'closed');
    const openShifts = shifts.filter((shift) => shift.status === 'open');
    return { closedShifts, openShifts };
}

export function calculateOpenShiftAggregates(
    openShifts: ShiftRow[],
    shiftItemsMap: Record<string, FinanceStatsShiftItem[]>
) {
    let totalBaseMasterShare = 0;
    let totalGuaranteedAmount = 0;
    let hasGuaranteedPayment = false;

    for (const shift of openShifts) {
        const shiftItems = shiftItemsMap[shift.id] || [];
        const shiftTotalAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
        const shiftPercentMaster = Number(shift.percent_master ?? 60);
        const shiftPercentSalon = Number(shift.percent_salon ?? 40);
        const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
        const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
        const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
        totalBaseMasterShare += baseMasterShare;

        const hourlyRate = shift.hourly_rate
            ? Number(shift.hourly_rate)
            : (shift.staff?.hourly_rate ? Number(shift.staff.hourly_rate) : null);

        if (hourlyRate && shift.opened_at) {
            const openedAt = new Date(shift.opened_at);
            const now = new Date();
            const diffMs = now.getTime() - openedAt.getTime();
            const hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
            const guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;
            totalGuaranteedAmount += guaranteedAmount;

            if (guaranteedAmount > baseMasterShare) {
                hasGuaranteedPayment = true;
            }
        }
    }

    return {
        totalBaseMasterShare,
        totalGuaranteedAmount,
        hasGuaranteedPayment,
    };
}
