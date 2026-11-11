/**
 * Расчёт гарантированной суммы и доплаты (topup).
 */

export function calculateGuaranteedAmount(
    hoursWorked: number | null,
    hourlyRate: number | null,
): number {
    if (!hoursWorked || !hourlyRate || hoursWorked <= 0 || hourlyRate <= 0) {
        return 0;
    }

    return Math.round(hoursWorked * hourlyRate * 100) / 100;
}

export function calculateTopupAmount(
    guaranteedAmount: number,
    baseMasterShare: number,
): number {
    if (guaranteedAmount > baseMasterShare) {
        return Math.round((guaranteedAmount - baseMasterShare) * 100) / 100;
    }
    return 0;
}


/** The financial date is a local calendar day; DST may make it 23 or 25 hours. */
export function isShiftDurationWithinDay(hoursWorked: number | null, dayHours: number): boolean {
    return Number.isFinite(dayHours) && dayHours > 0 && (hoursWorked === null || (Number.isFinite(hoursWorked) && hoursWorked >= 0 && hoursWorked <= dayHours));
}
