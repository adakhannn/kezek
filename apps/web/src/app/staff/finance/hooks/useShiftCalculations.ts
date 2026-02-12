// apps/web/src/app/staff/finance/hooks/useShiftCalculations.ts

import { useMemo } from 'react';

import type { ShiftItem, Shift } from '../types';

import {
    calculateTotalServiceAmount,
    calculateTotalConsumables,
    calculateBaseShares,
    calculateDisplayShares,
} from '@/lib/financeDomain';

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
        return JSON.stringify(items.map((it) => ({
            serviceAmount: typeof it.serviceAmount === 'number' && !isNaN(it.serviceAmount) ? it.serviceAmount : 0,
            consumablesAmount: typeof it.consumablesAmount === 'number' && !isNaN(it.consumablesAmount) ? it.consumablesAmount : 0,
        })));
    }, [items]);

    // Мемоизируем стабильные значения из shift
    const shiftSignature = useMemo(() => {
        if (!shift) return null;
        return JSON.stringify({
            total_amount: typeof shift.total_amount === 'number' && !isNaN(shift.total_amount) ? shift.total_amount : 0,
            master_share: typeof shift.master_share === 'number' && !isNaN(shift.master_share) ? shift.master_share : 0,
            salon_share: typeof shift.salon_share === 'number' && !isNaN(shift.salon_share) ? shift.salon_share : 0,
        });
    }, [shift]);

    return useMemo(() => {
        // Вычисляем суммы
        const totalAmount = calculateTotalServiceAmount(items);
        const totalConsumables = calculateTotalConsumables(items);

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
                displayTotalAmount: isOpen ? totalAmount : (shift.total_amount || 0),
            };
        }

        // Вычисляем базовые доли
        const { masterShare: baseMasterShare, salonShare: baseSalonShare } = calculateBaseShares(
            totalAmount,
            totalConsumables,
            staffPercentMaster,
            staffPercentSalon
        );

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
            displayTotalAmount: totalAmount,
        };
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

