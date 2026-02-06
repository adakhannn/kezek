// apps/web/src/app/staff/finance/hooks/useShiftCalculations.ts

import { useMemo } from 'react';

import type { ShiftItem, Shift } from '../types';

export interface ShiftCalculations {
    totalAmount: number;
    totalConsumables: number;
    masterShare: number;
    salonShare: number;
    displayTotalAmount: number;
}

/**
 * Хук для расчета финансовых показателей смены
 */
export function useShiftCalculations(
    items: ShiftItem[],
    shift: Shift | null,
    isOpen: boolean,
    staffPercentMaster: number,
    staffPercentSalon: number,
    hourlyRate: number | null,
    currentGuaranteedAmount: number | null
): ShiftCalculations {
    return useMemo(() => {
        // Сумма услуг = сумма всех serviceAmount
        const totalServiceFromItems = items.reduce(
            (sum, it) => sum + (Number(it.serviceAmount ?? 0) || 0),
            0
        );
        // Сумма расходников = сумма всех consumablesAmount
        const totalConsumablesFromItems = items.reduce(
            (sum, it) => sum + (Number(it.consumablesAmount ?? 0) || 0),
            0
        );

        const totalAmount = totalServiceFromItems;
        const finalConsumables = totalConsumablesFromItems;

        // Проценты считаются от общей суммы услуг (до вычета расходников)
        // Расходники добавляются к доле бизнеса сверху
        const pM = staffPercentMaster;
        const pS = staffPercentSalon;
        const ps = pM + pS || 100;
        // Базовая доля сотрудника = процент от общей суммы услуг
        const baseStaffShare = Math.round((totalAmount * pM) / ps);
        // Базовая доля бизнеса = процент от общей суммы услуг + 100% расходников
        const baseBizShareFromAmount = Math.round((totalAmount * pS) / ps);
        const baseBizShare = baseBizShareFromAmount + finalConsumables;

        // С учётом оплаты за выход:
        // если гарантированная сумма за выход больше базовой доли сотрудника,
        // разница вычитается из доли бизнеса
        let mShare = baseStaffShare;
        let sShare = baseBizShare;

        // Для открытой смены используем текущую гарантированную сумму
        if (isOpen && hourlyRate && currentGuaranteedAmount !== null && currentGuaranteedAmount !== undefined) {
            const guarantee = currentGuaranteedAmount;
            if (guarantee > baseStaffShare) {
                const diff = Math.round((guarantee - baseStaffShare) * 100) / 100;
                mShare = Math.round(guarantee);
                sShare = baseBizShare - diff;
            }
        }

        // Для закрытой смены используем сохранённые значения из БД
        if (!isOpen && shift) {
            // Используем сохранённые значения из смены (они уже правильно рассчитаны при закрытии)
            mShare = Math.round((shift.master_share ?? 0) * 100) / 100;
            sShare = Math.round((shift.salon_share ?? 0) * 100) / 100;
        }

        // Общий оборот: для открытой смены - из items, для закрытой - из shift.total_amount
        const displayTotalAmount = isOpen 
            ? totalAmount 
            : (shift?.total_amount ?? 0);

        return {
            totalAmount,
            totalConsumables: finalConsumables,
            masterShare: mShare,
            salonShare: sShare,
            displayTotalAmount,
        };
    }, [items, shift, isOpen, staffPercentMaster, staffPercentSalon, hourlyRate, currentGuaranteedAmount]);
}

