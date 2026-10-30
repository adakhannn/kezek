/** Named presentation bases; payout calculations and persisted totals stay unchanged. */
export function shiftSummaryAmounts(values: { displayTotalAmount: number; totalConsumables: number }) {
    return {
        services: values.displayTotalAmount,
        consumables: values.totalConsumables,
        total: values.displayTotalAmount + values.totalConsumables,
    };
}
