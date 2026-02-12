/**
 * Нормализация процентов
 */

export interface NormalizedPercentages {
    master: number;
    salon: number;
    sum: number;
}

/**
 * Нормализует проценты мастера и салона
 * 
 * Если сумма процентов не равна 100, нормализует их пропорционально
 * 
 * @param percentMaster - процент мастера (например, 60)
 * @param percentSalon - процент салона (например, 40)
 * @returns нормализованные проценты
 * 
 * @example
 * normalizePercentages(60, 40) // { master: 60, salon: 40, sum: 100 }
 * normalizePercentages(30, 20) // { master: 60, salon: 40, sum: 50 } -> нормализуется до 100
 */
export function normalizePercentages(
    percentMaster: number,
    percentSalon: number
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

