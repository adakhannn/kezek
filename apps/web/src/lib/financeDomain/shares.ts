/**
 * Расчет базовых долей мастера и салона
 */

import { normalizePercentages } from './normalize';

/**
 * Вычисляет базовую долю мастера от общей суммы услуг
 * 
 * @param totalAmount - общая сумма услуг
 * @param percentMaster - процент мастера (например, 60)
 * @param percentSalon - процент салона (например, 40)
 * @returns базовая доля мастера (округленная до целого)
 * 
 * @example
 * calculateBaseMasterShare(1000, 60, 40) // 600
 */
export function calculateBaseMasterShare(
    totalAmount: number,
    percentMaster: number,
    percentSalon: number
): number {
    const normalized = normalizePercentages(percentMaster, percentSalon);
    return Math.round((totalAmount * normalized.master) / 100);
}

/**
 * Вычисляет базовую долю салона от общей суммы услуг + расходники
 * 
 * Расходники (consumables) всегда идут 100% салону
 * 
 * @param totalAmount - общая сумма услуг
 * @param totalConsumables - общая сумма расходников
 * @param percentMaster - процент мастера (например, 60)
 * @param percentSalon - процент салона (например, 40)
 * @returns базовая доля салона (округленная до целого)
 * 
 * @example
 * calculateBaseSalonShare(1000, 100, 60, 40) // 400 + 100 = 500
 */
export function calculateBaseSalonShare(
    totalAmount: number,
    totalConsumables: number,
    percentMaster: number,
    percentSalon: number
): number {
    const normalized = normalizePercentages(percentMaster, percentSalon);
    const shareFromAmount = Math.round((totalAmount * normalized.salon) / 100);
    return shareFromAmount + totalConsumables;
}

/**
 * Вычисляет базовые доли мастера и салона
 * 
 * @param totalAmount - общая сумма услуг
 * @param totalConsumables - общая сумма расходников
 * @param percentMaster - процент мастера (например, 60)
 * @param percentSalon - процент салона (например, 40)
 * @returns базовые доли мастера и салона
 */
export function calculateBaseShares(
    totalAmount: number,
    totalConsumables: number,
    percentMaster: number,
    percentSalon: number
): { masterShare: number; salonShare: number } {
    return {
        masterShare: calculateBaseMasterShare(totalAmount, percentMaster, percentSalon),
        salonShare: calculateBaseSalonShare(totalAmount, totalConsumables, percentMaster, percentSalon),
    };
}

