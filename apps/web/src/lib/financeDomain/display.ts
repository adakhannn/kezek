/**
 * Расчет финальных долей для отображения (с учетом гарантий для открытых смен)
 */

import { calculateTopupAmount } from './guarantee';

export interface DisplayShares {
    masterShare: number;
    salonShare: number;
}

/**
 * Вычисляет финальные доли для отображения с учетом гарантированной суммы
 * 
 * Для открытых смен учитывает текущую гарантированную сумму
 * Для закрытых смен использует сохраненные значения из БД
 * 
 * @param baseMasterShare - базовая доля мастера
 * @param baseSalonShare - базовая доля салона
 * @param guaranteedAmount - гарантированная сумма (может быть null для открытых смен)
 * @param isOpen - открыта ли смена
 * @returns финальные доли для отображения
 */
export function calculateDisplayShares(
    baseMasterShare: number,
    baseSalonShare: number,
    guaranteedAmount: number | null,
    isOpen: boolean
): DisplayShares {
    // Для открытой смены используем текущую гарантированную сумму
    if (isOpen && guaranteedAmount !== null && guaranteedAmount !== undefined) {
        const topupAmount = calculateTopupAmount(guaranteedAmount, baseMasterShare);
        const finalMasterShare = guaranteedAmount > baseMasterShare 
            ? guaranteedAmount 
            : baseMasterShare;
        const finalSalonShare = Math.max(0, baseSalonShare - topupAmount);
        
        return {
            masterShare: Math.round(finalMasterShare * 100) / 100,
            salonShare: Math.round(finalSalonShare * 100) / 100,
        };
    }
    
    // Для закрытой смены или без гарантии используем базовые доли
    return {
        masterShare: Math.round(baseMasterShare * 100) / 100,
        salonShare: Math.round(baseSalonShare * 100) / 100,
    };
}

