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
        // Безопасное преобразование с проверками на null/undefined
        const totalServiceFromItems = items.reduce(
            (sum: number, it: ShiftItem) => {
                const amount = typeof it.serviceAmount === 'number' && !isNaN(it.serviceAmount)
                    ? it.serviceAmount
                    : 0;
                return sum + (amount >= 0 ? amount : 0);
            },
            0
        );
        // Сумма расходников = сумма всех consumablesAmount
        const totalConsumablesFromItems = items.reduce(
            (sum: number, it: ShiftItem) => {
                const amount = typeof it.consumablesAmount === 'number' && !isNaN(it.consumablesAmount)
                    ? it.consumablesAmount
                    : 0;
                return sum + (amount >= 0 ? amount : 0);
            },
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
            // Безопасное извлечение с проверками на null/undefined
            const masterShare = typeof shift.master_share === 'number' && !isNaN(shift.master_share)
                ? shift.master_share
                : 0;
            const salonShare = typeof shift.salon_share === 'number' && !isNaN(shift.salon_share)
                ? shift.salon_share
                : 0;
            mShare = Math.round(masterShare * 100) / 100;
            sShare = Math.round(salonShare * 100) / 100;
        }

        // Общий оборот: для открытой смены - из items, для закрытой - из shift.total_amount
        const displayTotalAmount = isOpen 
            ? totalAmount 
            : (shift && typeof shift.total_amount === 'number' && !isNaN(shift.total_amount)
                ? shift.total_amount
                : 0);

        return {
            totalAmount,
            totalConsumables: finalConsumables,
            masterShare: mShare,
            salonShare: sShare,
            displayTotalAmount,
        };
    }, [items, shift, isOpen, staffPercentMaster, staffPercentSalon, hourlyRate, currentGuaranteedAmount]);
}

