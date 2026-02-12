/**
 * Расчет финальных долей с учетом гарантий и доплат
 */

import { calculateGuaranteedAmount, calculateTopupAmount } from './guarantee';
import { calculateBaseShares } from './shares';

export interface ShiftFinancials {
    totalAmount: number;
    totalConsumables: number;
    baseMasterShare: number;
    baseSalonShare: number;
    guaranteedAmount: number;
    topupAmount: number;
    finalMasterShare: number;
    finalSalonShare: number;
    normalizedPercentMaster: number;
    normalizedPercentSalon: number;
}

export interface CalculateShiftFinancialsOptions {
    totalAmount: number;
    totalConsumables: number;
    percentMaster: number;
    percentSalon: number;
    hoursWorked: number | null;
    hourlyRate: number | null;
}

/**
 * Вычисляет все финансовые показатели смены
 * 
 * Включает:
 * - Базовые доли мастера и салона
 * - Гарантированную сумму (если указана ставка за час)
 * - Доплату (topup) - разницу между гарантией и базовой долей
 * - Финальные доли с учетом гарантий и доплат
 * 
 * @param options - параметры для расчета
 * @returns все финансовые показатели смены
 * 
 * @example
 * calculateShiftFinancials({
 *   totalAmount: 10000,
 *   totalConsumables: 500,
 *   percentMaster: 60,
 *   percentSalon: 40,
 *   hoursWorked: 8,
 *   hourlyRate: 500
 * })
 */
export function calculateShiftFinancials(
    options: CalculateShiftFinancialsOptions
): ShiftFinancials {
    const {
        totalAmount,
        totalConsumables,
        percentMaster,
        percentSalon,
        hoursWorked,
        hourlyRate,
    } = options;
    
    // Нормализуем проценты
    const safeMaster = Number.isFinite(percentMaster) && percentMaster >= 0 ? percentMaster : 60;
    const safeSalon = Number.isFinite(percentSalon) && percentSalon >= 0 ? percentSalon : 40;
    const percentSum = safeMaster + safeSalon || 100;
    const normalizedPercentMaster = (safeMaster / percentSum) * 100;
    const normalizedPercentSalon = (safeSalon / percentSum) * 100;
    
    // Вычисляем базовые доли
    const { masterShare: baseMasterShare, salonShare: baseSalonShare } = calculateBaseShares(
        totalAmount,
        totalConsumables,
        percentMaster,
        percentSalon
    );
    
    // Вычисляем гарантированную сумму
    const guaranteedAmount = calculateGuaranteedAmount(hoursWorked, hourlyRate);
    
    // Вычисляем доплату
    const topupAmount = calculateTopupAmount(guaranteedAmount, baseMasterShare);
    
    // Финальные доли:
    // - Мастер получает максимум из гарантированной суммы и базовой доли
    // - Салон получает базовую долю минус доплата (но не меньше 0)
    const finalMasterShare = guaranteedAmount > baseMasterShare 
        ? guaranteedAmount 
        : baseMasterShare;
    const finalSalonShare = Math.max(0, baseSalonShare - topupAmount);
    
    return {
        totalAmount,
        totalConsumables,
        baseMasterShare,
        baseSalonShare,
        guaranteedAmount,
        topupAmount,
        finalMasterShare: Math.round(finalMasterShare * 100) / 100,
        finalSalonShare: Math.round(finalSalonShare * 100) / 100,
        normalizedPercentMaster,
        normalizedPercentSalon,
    };
}

