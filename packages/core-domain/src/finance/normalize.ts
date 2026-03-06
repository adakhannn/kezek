/**
 * Нормализация процентов мастера и салона.
 */

export interface NormalizedPercentages {
    master: number;
    salon: number;
    sum: number;
}

/**
 * Нормализует проценты мастера и салона.
 *
 * Если сумма процентов не равна 100, нормализует их пропорционально.
 */
export function normalizePercentages(
    percentMaster: number,
    percentSalon: number,
): NormalizedPercentages {
    const safeMaster = Number.isFinite(percentMaster) && percentMaster >= 0 ? percentMaster : 60;
    const safeSalon = Number.isFinite(percentSalon) && percentSalon >= 0 ? percentSalon : 40;
    const sum = safeMaster + safeSalon || 100;

    return {
        master: (safeMaster / sum) * 100,
        salon: (safeSalon / sum) * 100,
        sum: 100,
    };
}

