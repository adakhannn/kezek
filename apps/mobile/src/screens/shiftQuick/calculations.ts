import type { FinanceData, ShiftItem } from './types';

export function getShiftTotals(items: ShiftItem[]) {
    const totalAmount = items.reduce((sum, item) => sum + (item.serviceAmount || 0), 0);
    const totalConsumables = items.reduce((sum, item) => sum + (item.consumablesAmount || 0), 0);

    return {
        totalAmount,
        totalConsumables,
    };
}

export function getShiftCompensation(items: ShiftItem[], financeData?: FinanceData | null) {
    const { totalAmount, totalConsumables } = getShiftTotals(items);
    const percentMaster = financeData?.staffPercentMaster || 60;
    const percentSalon = financeData?.staffPercentSalon || 40;
    const normalizedMaster = (percentMaster / (percentMaster + percentSalon)) * 100;
    const baseMasterShare = Math.round((totalAmount * normalizedMaster) / 100);
    const currentGuaranteed = financeData?.currentGuaranteedAmount || 0;
    const finalMasterShare = currentGuaranteed > baseMasterShare ? currentGuaranteed : baseMasterShare;
    const topupAmount = Math.max(0, currentGuaranteed - baseMasterShare);
    const baseSalonShare = Math.round((totalAmount * (100 - normalizedMaster)) / 100) + totalConsumables;
    const finalSalonShare = Math.max(0, baseSalonShare - topupAmount);

    return {
        totalAmount,
        totalConsumables,
        percentMaster,
        percentSalon,
        normalizedMaster,
        baseMasterShare,
        currentGuaranteed,
        finalMasterShare,
        topupAmount,
        baseSalonShare,
        finalSalonShare,
    };
}
