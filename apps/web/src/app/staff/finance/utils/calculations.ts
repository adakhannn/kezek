// apps/web/src/app/staff/finance/utils/calculations.ts

import type { ShiftItem, Shift } from '../types';

import {
    calculateTotalServiceAmount,
    calculateTotalConsumables,
    calculateBaseShares,
    calculateDisplayShares,
} from '@/lib/financeDomain';

/**
 * Чистые функции для финансовых расчетов
 * Используют единый доменный слой financeDomain
 * 
 * @deprecated Используйте функции напрямую из @/lib/financeDomain
 */

/**
 * Вычисляет общую сумму услуг из массива items
 * @deprecated Используйте calculateTotalServiceAmount из @/lib/financeDomain
 */
export { calculateTotalServiceAmount };

/**
 * Вычисляет общую сумму расходников из массива items
 * @deprecated Используйте calculateTotalConsumables из @/lib/financeDomain
 */
export { calculateTotalConsumables };

/**
 * Вычисляет базовую долю сотрудника от общей суммы услуг
 * @deprecated Используйте calculateBaseShares из @/lib/financeDomain
 */
export function calculateBaseStaffShare(
    totalAmount: number,
    staffPercentMaster: number,
    staffPercentSalon: number
): number {
    const { masterShare } = calculateBaseShares(totalAmount, 0, staffPercentMaster, staffPercentSalon);
    return masterShare;
}

/**
 * Вычисляет базовую долю бизнеса от общей суммы услуг + расходники
 * @deprecated Используйте calculateBaseShares из @/lib/financeDomain
 */
export function calculateBaseBizShare(
    totalAmount: number,
    totalConsumables: number,
    staffPercentMaster: number,
    staffPercentSalon: number
): number {
    const { salonShare } = calculateBaseShares(totalAmount, totalConsumables, staffPercentMaster, staffPercentSalon);
    return salonShare;
}

/**
 * Вычисляет финальные доли с учетом гарантированной суммы
 * @deprecated Используйте calculateDisplayShares из @/lib/financeDomain
 */
export function calculateFinalShares(
    baseStaffShare: number,
    baseBizShare: number,
    hourlyRate: number | null,
    currentGuaranteedAmount: number | null,
    isOpen: boolean
): { masterShare: number; salonShare: number } {
    return calculateDisplayShares(baseStaffShare, baseBizShare, currentGuaranteedAmount, isOpen);
}

/**
 * Вычисляет общий оборот для отображения
 */
export function calculateDisplayTotalAmount(
    totalAmount: number,
    shift: Shift | null,
    isOpen: boolean
): number {
    if (isOpen) {
        return totalAmount;
    }
    
    if (shift && typeof shift.total_amount === 'number' && !isNaN(shift.total_amount)) {
        return shift.total_amount;
    }
    
    return 0;
}

/**
 * Полный расчет финансовых показателей смены
 */
export interface ShiftCalculationsResult {
    totalAmount: number;
    totalConsumables: number;
    masterShare: number;
    salonShare: number;
    displayTotalAmount: number;
}

export function calculateShiftFinancials(
    items: ShiftItem[],
    shift: Shift | null,
    isOpen: boolean,
    staffPercentMaster: number,
    staffPercentSalon: number,
    hourlyRate: number | null,
    currentGuaranteedAmount: number | null
): ShiftCalculationsResult {
    // Вычисляем суммы
    const totalAmount = calculateTotalServiceAmount(items);
    const totalConsumables = calculateTotalConsumables(items);

    // Вычисляем базовые доли
    const { masterShare: baseMasterShare, salonShare: baseSalonShare } = calculateBaseShares(
        totalAmount,
        totalConsumables,
        staffPercentMaster,
        staffPercentSalon
    );

    // Для закрытой смены используем сохранённые значения из БД
    if (!isOpen && shift) {
        const masterShare = typeof shift.master_share === 'number' && !isNaN(shift.master_share)
            ? shift.master_share
            : 0;
        const salonShare = typeof shift.salon_share === 'number' && !isNaN(shift.salon_share)
            ? shift.salon_share
            : 0;
        
        return {
            totalAmount,
            totalConsumables,
            masterShare: Math.round(masterShare * 100) / 100,
            salonShare: Math.round(salonShare * 100) / 100,
            displayTotalAmount: calculateDisplayTotalAmount(totalAmount, shift, isOpen),
        };
    }

    // Для открытой смены вычисляем с учетом гарантий
    const { masterShare, salonShare } = calculateDisplayShares(
        baseMasterShare,
        baseSalonShare,
        currentGuaranteedAmount,
        isOpen
    );

    return {
        totalAmount,
        totalConsumables,
        masterShare,
        salonShare,
        displayTotalAmount: calculateDisplayTotalAmount(totalAmount, shift, isOpen),
    };
}

