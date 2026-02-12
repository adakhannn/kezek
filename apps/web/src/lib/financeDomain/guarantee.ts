/**
 * Расчет гарантированной суммы и доплаты
 */

/**
 * Вычисляет гарантированную сумму на основе отработанных часов и ставки за час
 * 
 * @param hoursWorked - количество отработанных часов
 * @param hourlyRate - ставка за час (может быть null)
 * @returns гарантированная сумма (округленная до 2 знаков) или 0
 * 
 * @example
 * calculateGuaranteedAmount(8, 500) // 4000
 * calculateGuaranteedAmount(8.5, 500) // 4250
 * calculateGuaranteedAmount(8, null) // 0
 */
export function calculateGuaranteedAmount(
    hoursWorked: number | null,
    hourlyRate: number | null
): number {
    if (!hoursWorked || !hourlyRate || hoursWorked <= 0 || hourlyRate <= 0) {
        return 0;
    }
    
    return Math.round(hoursWorked * hourlyRate * 100) / 100;
}

/**
 * Вычисляет доплату (topup) - разницу между гарантированной суммой и базовой долей мастера
 * 
 * Доплата применяется только если гарантированная сумма больше базовой доли мастера
 * 
 * @param guaranteedAmount - гарантированная сумма
 * @param baseMasterShare - базовая доля мастера
 * @returns доплата (округленная до 2 знаков) или 0
 * 
 * @example
 * calculateTopupAmount(5000, 3000) // 2000
 * calculateTopupAmount(3000, 5000) // 0 (гарантия меньше базовой доли)
 */
export function calculateTopupAmount(
    guaranteedAmount: number,
    baseMasterShare: number
): number {
    if (guaranteedAmount > baseMasterShare) {
        return Math.round((guaranteedAmount - baseMasterShare) * 100) / 100;
    }
    return 0;
}

