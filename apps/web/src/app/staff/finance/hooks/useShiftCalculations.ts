// apps/web/src/app/staff/finance/hooks/useShiftCalculations.ts

import { useMemo } from 'react';

import type { ShiftItem, Shift } from '../types';
import { calculateShiftFinancials } from '../utils/calculations';

export interface ShiftCalculations {
    totalAmount: number;
    totalConsumables: number;
    masterShare: number;
    salonShare: number;
    displayTotalAmount: number;
}

/**
 * Хук для расчета финансовых показателей смены
 * Оптимизирован: использует чистые функции и стабильные зависимости
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
    // Мемоизируем стабильные значения из items для оптимизации зависимостей
    // Вместо зависимости от всего массива items, используем только необходимые значения
    const itemsSignature = useMemo(() => {
        // Создаем стабильную сигнатуру массива items для сравнения
        // Используем только те поля, которые влияют на расчеты
        return items.map((it) => ({
            serviceAmount: typeof it.serviceAmount === 'number' && !isNaN(it.serviceAmount) ? it.serviceAmount : 0,
            consumablesAmount: typeof it.consumablesAmount === 'number' && !isNaN(it.consumablesAmount) ? it.consumablesAmount : 0,
        }));
    }, [items]);

    // Мемоизируем стабильные значения из shift
    const shiftSignature = useMemo(() => {
        if (!shift) return null;
        return {
            total_amount: typeof shift.total_amount === 'number' && !isNaN(shift.total_amount) ? shift.total_amount : 0,
            master_share: typeof shift.master_share === 'number' && !isNaN(shift.master_share) ? shift.master_share : 0,
            salon_share: typeof shift.salon_share === 'number' && !isNaN(shift.salon_share) ? shift.salon_share : 0,
        };
    }, [shift]);

    return useMemo(() => {
        return calculateShiftFinancials(
            items,
            shift,
            isOpen,
            staffPercentMaster,
            staffPercentSalon,
            hourlyRate,
            currentGuaranteedAmount
        );
    }, [
        itemsSignature,
        shiftSignature,
        isOpen,
        staffPercentMaster,
        staffPercentSalon,
        hourlyRate,
        currentGuaranteedAmount,
    ]);
}

