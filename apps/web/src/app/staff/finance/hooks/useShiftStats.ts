// apps/web/src/app/staff/finance/hooks/useShiftStats.ts

import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useMemo } from 'react';

import type { Stats, PeriodKey } from '../types';

import { TZ } from '@/lib/time';


interface UseShiftStatsOptions {
    allShifts: Array<{
        shift_date: string;
        status: string;
        total_amount: number;
        master_share: number;
        salon_share: number;
        late_minutes: number;
        guaranteed_amount?: number;
        topup_amount?: number;
    }>;
    statsPeriod: PeriodKey;
    selectedDate: Date;
    selectedMonth: Date;
    selectedYear: number;
}

/**
 * Хук для расчета статистики по сменам
 * Оптимизирован: нормализует Date объекты в строки для стабильных зависимостей
 */
export function useShiftStats({
    allShifts,
    statsPeriod,
    selectedDate,
    selectedMonth,
    selectedYear,
}: UseShiftStatsOptions): Stats {
    // Нормализуем Date объекты в строки для стабильных зависимостей
    // Это предотвращает пересчет при каждом рендере, даже если Date объекты технически "новые"
    const dateStr = useMemo(() => formatInTimeZone(selectedDate, TZ, 'yyyy-MM-dd'), [selectedDate]);
    const monthStr = useMemo(() => formatInTimeZone(selectedMonth, TZ, 'yyyy-MM'), [selectedMonth]);
    const yearStr = useMemo(() => String(selectedYear), [selectedYear]);

    // Мемоизируем стабильную сигнатуру allShifts
    const shiftsSignature = useMemo(() => {
        return allShifts.map((s) => ({
            shift_date: String(s.shift_date || '').split('T')[0].split(' ')[0].trim(),
            status: s.status,
            total_amount: Number(s.total_amount || 0),
            master_share: Number(s.master_share || 0),
            salon_share: Number(s.salon_share || 0),
            late_minutes: Number(s.late_minutes || 0),
            guaranteed_amount: Number(s.guaranteed_amount || 0),
            topup_amount: Number(s.topup_amount || 0),
        }));
    }, [allShifts]);

    return useMemo(() => {
        if (!shiftsSignature || shiftsSignature.length === 0) {
            return {
                totalAmount: 0,
                totalMaster: 0,
                totalSalon: 0,
                totalLateMinutes: 0,
                shiftsCount: 0,
            };
        }
        
        const closedShifts = shiftsSignature.filter((s) => s.status === 'closed');
        
        let filtered: typeof closedShifts = [];
        
        if (statsPeriod === 'day') {
            filtered = closedShifts.filter((s) => s.shift_date === dateStr);
        } else if (statsPeriod === 'month') {
            const monthStart = formatInTimeZone(startOfMonth(selectedMonth), TZ, 'yyyy-MM-dd');
            const monthEnd = formatInTimeZone(endOfMonth(selectedMonth), TZ, 'yyyy-MM-dd');
            filtered = closedShifts.filter((s) => s.shift_date >= monthStart && s.shift_date <= monthEnd);
        } else if (statsPeriod === 'year') {
            const yearStart = formatInTimeZone(startOfYear(new Date(selectedYear, 0, 1)), TZ, 'yyyy-MM-dd');
            const yearEnd = formatInTimeZone(endOfYear(new Date(selectedYear, 11, 31)), TZ, 'yyyy-MM-dd');
            filtered = closedShifts.filter((s) => s.shift_date >= yearStart && s.shift_date <= yearEnd);
        } else {
            filtered = closedShifts;
        }
        
        const totalAmount = filtered.reduce((sum, s) => sum + s.total_amount, 0);
        // Итоговая сумма сотрудника = гарантированная сумма (если есть и больше базовой доли) или базовая доля
        const totalMaster = filtered.reduce((sum, s) => {
            return sum + (s.guaranteed_amount > s.master_share ? s.guaranteed_amount : s.master_share);
        }, 0);
        // Бизнес получает долю от выручки, но вычитает доплату владельца
        const totalSalon = filtered.reduce((sum, s) => {
            return sum + s.salon_share - s.topup_amount;
        }, 0);
        const totalLateMinutes = filtered.reduce((sum, s) => sum + s.late_minutes, 0);
        
        return {
            totalAmount,
            totalMaster,
            totalSalon,
            totalLateMinutes,
            shiftsCount: filtered.length,
        };
    }, [shiftsSignature, statsPeriod, dateStr, monthStr, yearStr, selectedMonth, selectedYear]);
}

