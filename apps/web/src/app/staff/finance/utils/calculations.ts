// apps/web/src/app/staff/finance/utils/calculations.ts

import type { ShiftItem, Shift } from '../types';

/**
 * Чистые функции для финансовых расчетов
 * Можно использовать как на клиенте, так и на сервере
 */

/**
 * Вычисляет общую сумму услуг из массива items
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
 * Вычисляет базовую долю сотрудника от общей суммы услуг
 */
export function calculateBaseStaffShare(
    totalAmount: number,
    staffPercentMaster: number,
    staffPercentSalon: number
): number {
    const ps = staffPercentMaster + staffPercentSalon || 100;
    return Math.round((totalAmount * staffPercentMaster) / ps);
}

/**
 * Вычисляет базовую долю бизнеса от общей суммы услуг + расходники
 */
export function calculateBaseBizShare(
    totalAmount: number,
    totalConsumables: number,
    staffPercentMaster: number,
    staffPercentSalon: number
): number {
    const ps = staffPercentMaster + staffPercentSalon || 100;
    const shareFromAmount = Math.round((totalAmount * staffPercentSalon) / ps);
    return shareFromAmount + totalConsumables;
}

/**
 * Вычисляет финальные доли с учетом гарантированной суммы
 */
export function calculateFinalShares(
    baseStaffShare: number,
    baseBizShare: number,
    hourlyRate: number | null,
    currentGuaranteedAmount: number | null,
    isOpen: boolean
): { masterShare: number; salonShare: number } {
    let masterShare = baseStaffShare;
    let salonShare = baseBizShare;

    // Для открытой смены используем текущую гарантированную сумму
    if (isOpen && hourlyRate && currentGuaranteedAmount !== null && currentGuaranteedAmount !== undefined) {
        const guarantee = currentGuaranteedAmount;
        if (guarantee > baseStaffShare) {
            const diff = Math.round((guarantee - baseStaffShare) * 100) / 100;
            masterShare = Math.round(guarantee);
            salonShare = baseBizShare - diff;
        }
    }

    return {
        masterShare: Math.round(masterShare * 100) / 100,
        salonShare: Math.round(salonShare * 100) / 100,
    };
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
    const baseStaffShare = calculateBaseStaffShare(totalAmount, staffPercentMaster, staffPercentSalon);
    const baseBizShare = calculateBaseBizShare(totalAmount, totalConsumables, staffPercentMaster, staffPercentSalon);

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
    const { masterShare, salonShare } = calculateFinalShares(
        baseStaffShare,
        baseBizShare,
        hourlyRate,
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

