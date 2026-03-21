/**
 * Расчёт финальных долей для отображения (с учётом гарантии для открытых смен).
 */

import { calculateTopupAmount } from './guarantee';

export interface DisplayShares {
    masterShare: number;
    salonShare: number;
}

export function calculateDisplayShares(
    baseMasterShare: number,
    baseSalonShare: number,
    guaranteedAmount: number | null,
    isOpen: boolean,
): DisplayShares {
    if (isOpen && guaranteedAmount !== null && guaranteedAmount !== undefined) {
        const topupAmount = calculateTopupAmount(guaranteedAmount, baseMasterShare);
        const finalMasterShare = guaranteedAmount > baseMasterShare ? guaranteedAmount : baseMasterShare;
        const finalSalonShare = Math.max(0, baseSalonShare - topupAmount);

        return {
            masterShare: Math.round(finalMasterShare * 100) / 100,
            salonShare: Math.round(finalSalonShare * 100) / 100,
        };
    }

    return {
        masterShare: Math.round(baseMasterShare * 100) / 100,
        salonShare: Math.round(baseSalonShare * 100) / 100,
    };
}

