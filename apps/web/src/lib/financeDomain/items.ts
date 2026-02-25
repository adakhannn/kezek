/**
 * Расчет сумм из массива items
 */

export interface ShiftItem {
    serviceAmount?: number | null;
    consumablesAmount?: number | null;
}

/**
 * Корректирующая операция по смене (возвраты, ручные правки).
 *
 * В отличие от ShiftItem, здесь допустимы как положительные, так и отрицательные значения:
 * - отрицательные дельты уменьшают выручку/расходники (refund/скидка/списание);
 * - положительные дельты могут использоваться для доначислений.
 */
export interface ShiftAdjustment {
    serviceDelta?: number | null;
    consumablesDelta?: number | null;
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

/**
 * Применяет массив корректировок к базовым суммам смены.
 *
 * @param baseTotalAmount - базовая сумма услуг (из staff_shift_items)
 * @param baseTotalConsumables - базовая сумма расходников
 * @param adjustments - массив корректирующих операций
 * @returns скорректированные суммы (неотрицательные)
 */
export function applyAdjustmentsToTotals(
    baseTotalAmount: number,
    baseTotalConsumables: number,
    adjustments: ShiftAdjustment[]
): { totalAmount: number; totalConsumables: number } {
    if (!adjustments.length) {
        return {
            totalAmount: baseTotalAmount,
            totalConsumables: baseTotalConsumables,
        };
    }

    const deltas = adjustments.reduce(
        (acc, adj) => {
            const service =
                typeof adj.serviceDelta === 'number' && !isNaN(adj.serviceDelta)
                    ? adj.serviceDelta
                    : 0;
            const consumables =
                typeof adj.consumablesDelta === 'number' && !isNaN(adj.consumablesDelta)
                    ? adj.consumablesDelta
                    : 0;

            return {
                serviceDelta: acc.serviceDelta! + service,
                consumablesDelta: acc.consumablesDelta! + consumables,
            };
        },
        { serviceDelta: 0 as number, consumablesDelta: 0 as number }
    );

    const totalAmount = Math.max(0, baseTotalAmount + deltas.serviceDelta!);
    const totalConsumables = Math.max(0, baseTotalConsumables + deltas.consumablesDelta!);

    return { totalAmount, totalConsumables };
}

