/**
 * Полный расчёт финансов смены.
 */

import { calculateGuaranteedAmount, calculateTopupAmount } from './guarantee';
import type { PaymentMode } from './modes';
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
    paymentMode?: PaymentMode;
}

export function calculateShiftFinancials(
    options: CalculateShiftFinancialsOptions,
): ShiftFinancials {
    const {
        totalAmount,
        totalConsumables,
        percentMaster,
        percentSalon,
        hoursWorked,
        hourlyRate,
        paymentMode = 'percent_with_guarantee',
    } = options;

    const safeMaster = Number.isFinite(percentMaster) && percentMaster >= 0 ? percentMaster : 60;
    const safeSalon = Number.isFinite(percentSalon) && percentSalon >= 0 ? percentSalon : 40;
    const percentSum = safeMaster + safeSalon || 100;
    const normalizedPercentMaster = (safeMaster / percentSum) * 100;
    const normalizedPercentSalon = (safeSalon / percentSum) * 100;

    const { masterShare: baseMasterShare, salonShare: baseSalonShare } = calculateBaseShares(
        totalAmount,
        totalConsumables,
        percentMaster,
        percentSalon,
    );

    if (paymentMode === 'percent_only') {
        return {
            totalAmount,
            totalConsumables,
            baseMasterShare,
            baseSalonShare,
            guaranteedAmount: 0,
            topupAmount: 0,
            finalMasterShare: Math.round(baseMasterShare * 100) / 100,
            finalSalonShare: Math.round(baseSalonShare * 100) / 100,
            normalizedPercentMaster,
            normalizedPercentSalon,
        };
    }

    const guaranteedAmount = calculateGuaranteedAmount(hoursWorked, hourlyRate);
    const topupAmount = calculateTopupAmount(guaranteedAmount, baseMasterShare);

    const finalMasterShare = guaranteedAmount > baseMasterShare ? guaranteedAmount : baseMasterShare;
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

