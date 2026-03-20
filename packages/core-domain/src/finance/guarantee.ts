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
