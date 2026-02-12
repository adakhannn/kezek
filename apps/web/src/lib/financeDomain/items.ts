/**
 * Расчет сумм из массива items
 */

export interface ShiftItem {
    serviceAmount?: number | null;
    consumablesAmount?: number | null;
}

/**
 * Вычисляет общую сумму услуг из массива items
 * 
 * @param items - массив позиций смены
 * @returns общая сумма услуг
 */
export function calculateTotalServiceAmount(items: ShiftItem[]): number {
    return items.reduce((sum, it) => {
        const amount = typeof it.serviceAmount === 'number' && !isNaN(it.serviceAmount)
            ? it.serviceAmount
            : 0;
        return sum + (amount >= 0 ? amount : 0);
    }, 0);
}

/**
 * Вычисляет общую сумму расходников из массива items
 * 
 * @param items - массив позиций смены
 * @returns общая сумма расходников
 */
export function calculateTotalConsumables(items: ShiftItem[]): number {
    return items.reduce((sum, it) => {
        const amount = typeof it.consumablesAmount === 'number' && !isNaN(it.consumablesAmount)
            ? it.consumablesAmount
            : 0;
        return sum + (amount >= 0 ? amount : 0);
    }, 0);
}

