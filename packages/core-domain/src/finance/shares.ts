/**
 * Расчёт базовых долей мастера и салона.
 */

import { normalizePercentages } from './normalize';

export function calculateBaseMasterShare(
    totalAmount: number,
    percentMaster: number,
    percentSalon: number,
): number {
    const normalized = normalizePercentages(percentMaster, percentSalon);
    return Math.round((totalAmount * normalized.master) / 100);
}

export function calculateBaseSalonShare(
    totalAmount: number,
    totalConsumables: number,
    percentMaster: number,
    percentSalon: number,
): number {
    const normalized = normalizePercentages(percentMaster, percentSalon);
    const shareFromAmount = Math.round((totalAmount * normalized.salon) / 100);
    return shareFromAmount + totalConsumables;
}

export function calculateBaseShares(
    totalAmount: number,
    totalConsumables: number,
    percentMaster: number,
    percentSalon: number,
): { masterShare: number; salonShare: number } {
    const masterShare = calculateBaseMasterShare(totalAmount, percentMaster, percentSalon);

    return {
        masterShare,
        // Assign the rounding remainder to the salon so the revenue split is conserved.
        salonShare: totalAmount - masterShare + totalConsumables,
    };
}

