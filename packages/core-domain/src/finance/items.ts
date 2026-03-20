export interface ShiftItem {
    serviceAmount?: number | null;
    consumablesAmount?: number | null;
}

export interface ShiftAdjustment {
    serviceDelta?: number | null;
    consumablesDelta?: number | null;
}

export function calculateTotalServiceAmount(items: ShiftItem[]): number {
    return items.reduce((sum, it) => {
        const amount =
            typeof it.serviceAmount === 'number' && !isNaN(it.serviceAmount)
                ? it.serviceAmount
                : 0;
        return sum + (amount >= 0 ? amount : 0);
    }, 0);
}

export function calculateTotalConsumables(items: ShiftItem[]): number {
    return items.reduce((sum, it) => {
        const amount =
            typeof it.consumablesAmount === 'number' && !isNaN(it.consumablesAmount)
                ? it.consumablesAmount
                : 0;
        return sum + (amount >= 0 ? amount : 0);
    }, 0);
}

export function applyAdjustmentsToTotals(
    baseTotalAmount: number,
    baseTotalConsumables: number,
    adjustments: ShiftAdjustment[],
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
                serviceDelta: acc.serviceDelta + service,
                consumablesDelta: acc.consumablesDelta + consumables,
            };
        },
        { serviceDelta: 0, consumablesDelta: 0 },
    );

    const totalAmount = Math.max(0, baseTotalAmount + deltas.serviceDelta);
    const totalConsumables = Math.max(0, baseTotalConsumables + deltas.consumablesDelta);

    return { totalAmount, totalConsumables };
}
