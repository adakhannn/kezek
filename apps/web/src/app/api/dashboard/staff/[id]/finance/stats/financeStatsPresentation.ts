import type { FinanceStatsShiftItem } from './financeStatsShiftItems';

import { logDebug } from '@/lib/log';


type ShiftRow = {
    id: string;
    shift_date: string;
    status: string;
    opened_at?: string | null;
    closed_at?: string | null;
    total_amount?: number | null;
    consumables_amount?: number | null;
    master_share?: number | null;
    salon_share?: number | null;
    late_minutes?: number | null;
    hours_worked?: number | null;
    hourly_rate?: number | null;
    guaranteed_amount?: number | null;
    percent_master?: number | null;
    percent_salon?: number | null;
    staff?: {
        hourly_rate?: number | null;
        percent_master?: number | null;
        percent_salon?: number | null;
    } | null;
};

type BuiltShift = {
    id: string;
    shift_date: string;
    status: string;
    opened_at?: string | null;
    closed_at?: string | null;
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    late_minutes: number;
    hours_worked: number | null;
    hourly_rate: number | null;
    guaranteed_amount: number;
    items: FinanceStatsShiftItem[];
};

type BuildFinanceStatsInput = {
    period: string;
    dateFrom: string;
    dateTo: string;
    staffName: string | null;
    finalShifts: ShiftRow[];
    closedShiftsCount: number;
    openShiftsCount: number;
    shiftItemsMap: Record<string, FinanceStatsShiftItem[]>;
    totalBaseMasterShare: number;
    totalGuaranteedAmount: number;
    hasGuaranteedPayment: boolean;
};

function buildShiftPresentation(
    shift: ShiftRow,
    shiftItemsMap: Record<string, FinanceStatsShiftItem[]>
): BuiltShift {
    const shiftItems = shiftItemsMap[shift.id] || [];
    const shiftTotalAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
    const shiftConsumables = shiftItems.reduce((sum, item) => sum + item.consumables_amount, 0);

    let displayTotalAmount = shiftTotalAmount;
    let displayMasterShare = Number(shift.master_share ?? 0);
    let displaySalonShare = Number(shift.salon_share ?? 0);

    const staffData = shift.staff;
    const hourlyRate = shift.hourly_rate
        ? Number(shift.hourly_rate)
        : (staffData?.hourly_rate ? Number(staffData.hourly_rate) : null);
    const staffPercentMaster = staffData?.percent_master ? Number(staffData.percent_master) : null;
    const staffPercentSalon = staffData?.percent_salon ? Number(staffData.percent_salon) : null;

    const shiftPercentMaster = Number(shift.percent_master ?? staffPercentMaster ?? 60);
    const shiftPercentSalon = Number(shift.percent_salon ?? staffPercentSalon ?? 40);
    const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
    const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
    const normalizedSalon = (shiftPercentSalon / percentSum) * 100;

    const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
    const baseSalonShare = Math.round((shiftTotalAmount * normalizedSalon) / 100) + shiftConsumables;

    if (shift.status === 'open') {
        if (hourlyRate && shift.opened_at) {
            const openedAt = new Date(shift.opened_at);
            const now = new Date();
            const diffMs = now.getTime() - openedAt.getTime();
            const hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
            const guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;

            logDebug('StaffFinanceStats', 'Open shift calculation', {
                shiftId: shift.id,
                shiftTotalAmount,
                baseMasterShare,
                hoursWorked,
                hourlyRate,
                guaranteedAmount,
                willUseGuaranteed: guaranteedAmount > baseMasterShare,
            });

            if (guaranteedAmount > baseMasterShare) {
                displayMasterShare = guaranteedAmount;
                const topupAmount = displayMasterShare - baseMasterShare;
                displaySalonShare = Math.max(0, baseSalonShare - topupAmount);
                logDebug('StaffFinanceStats', 'Using guaranteed amount', {
                    displayMasterShare,
                    topupAmount,
                    displaySalonShare,
                });
            } else {
                displayMasterShare = baseMasterShare;
                displaySalonShare = baseSalonShare;
            }
        } else {
            displayMasterShare = baseMasterShare;
            displaySalonShare = baseSalonShare;
        }
    } else {
        const dbGuaranteedAmount = Number(shift.guaranteed_amount ?? 0);
        const dbHoursWorked = shift.hours_worked ? Number(shift.hours_worked) : null;

        if (dbGuaranteedAmount > 0 && dbGuaranteedAmount > baseMasterShare) {
            displayMasterShare = dbGuaranteedAmount;
            const topupAmount = displayMasterShare - baseMasterShare;
            displaySalonShare = Math.max(0, baseSalonShare - topupAmount);
        } else {
            displayMasterShare = baseMasterShare;
            displaySalonShare = baseSalonShare;
        }

        logDebug('StaffFinanceStats', 'Closed shift calculation', {
            shiftId: shift.id,
            shiftDate: shift.shift_date,
            shiftTotalAmount,
            itemsCount: shiftItems.length,
            baseMasterShare,
            baseSalonShare,
            dbGuaranteedAmount,
            dbHoursWorked,
            displayMasterShare,
            displaySalonShare,
        });
    }

    let displayGuaranteedAmount = Number(shift.guaranteed_amount ?? 0);
    let displayHoursWorked: number | null = Number(shift.hours_worked ?? null);
    const displayHourlyRate: number | null = hourlyRate;

    if (shift.status === 'open' && hourlyRate && shift.opened_at) {
        const openedAt = new Date(shift.opened_at);
        const now = new Date();
        const diffMs = now.getTime() - openedAt.getTime();
        displayHoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        displayGuaranteedAmount = Math.round(displayHoursWorked * hourlyRate * 100) / 100;
    }

    const shiftItemsTyped: FinanceStatsShiftItem[] = shiftItems.map((item) => ({
        id: item.id,
        client_name: item.client_name || '',
        service_name: item.service_name || '',
        service_amount: item.service_amount,
        consumables_amount: item.consumables_amount,
        note: item.note || null,
        booking_id: item.booking_id || null,
        created_at: item.created_at ?? null,
    }));

    return {
        id: shift.id,
        shift_date: shift.shift_date,
        status: shift.status,
        opened_at: shift.opened_at,
        closed_at: shift.closed_at,
        total_amount: displayTotalAmount,
        consumables_amount: shiftConsumables,
        master_share: displayMasterShare,
        salon_share: displaySalonShare,
        late_minutes: Number(shift.late_minutes ?? 0),
        hours_worked: displayHoursWorked,
        hourly_rate: displayHourlyRate,
        guaranteed_amount: displayGuaranteedAmount,
        items: shiftItemsTyped,
    };
}

export function buildFinanceStats(input: BuildFinanceStatsInput) {
    const shifts = input.finalShifts.map((shift) => buildShiftPresentation(shift, input.shiftItemsMap));

    const stats = {
        period: input.period,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        staffName: input.staffName,
        shiftsCount: input.finalShifts.length,
        openShiftsCount: input.openShiftsCount,
        closedShiftsCount: input.closedShiftsCount,
        totalAmount: 0,
        totalMaster: 0,
        totalSalon: 0,
        totalConsumables: 0,
        totalLateMinutes: 0,
        totalClients: Object.values(input.shiftItemsMap).reduce((sum, items) => sum + items.length, 0),
        totalBaseMasterShare: input.totalBaseMasterShare,
        totalGuaranteedAmount: input.totalGuaranteedAmount,
        hasGuaranteedPayment: input.hasGuaranteedPayment,
        shifts,
    };

    logDebug('StaffFinanceStats', 'Calculating totals from shifts', { count: stats.shifts.length });
    for (const shift of stats.shifts) {
        const prevTotalMaster = stats.totalMaster;
        const prevTotalSalon = stats.totalSalon;

        stats.totalAmount += shift.total_amount;
        stats.totalMaster += shift.master_share;
        stats.totalSalon += shift.salon_share;
        stats.totalConsumables += shift.consumables_amount;
        stats.totalLateMinutes += shift.late_minutes;

        if (shift.status === 'open') {
            logDebug('StaffFinanceStats', 'Open shift totals', {
                shiftId: shift.id,
                shiftDate: shift.shift_date,
                totalAmount: shift.total_amount,
                masterShare: shift.master_share,
                salonShare: shift.salon_share,
                guaranteedAmount: shift.guaranteed_amount,
                hoursWorked: shift.hours_worked,
                hourlyRate: shift.hourly_rate,
                addedToTotalMaster: shift.master_share,
                addedToTotalSalon: shift.salon_share,
                totalMasterBefore: prevTotalMaster,
                totalMasterAfter: stats.totalMaster,
                totalSalonBefore: prevTotalSalon,
                totalSalonAfter: stats.totalSalon,
            });
        }
    }

    logDebug('StaffFinanceStats', 'Final totals', {
        totalAmount: stats.totalAmount,
        totalMaster: stats.totalMaster,
        totalSalon: stats.totalSalon,
        totalConsumables: stats.totalConsumables,
    });

    return stats;
}
