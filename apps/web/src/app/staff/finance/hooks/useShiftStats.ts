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
 */
export function useShiftStats({
    allShifts,
    statsPeriod,
    selectedDate,
    selectedMonth,
    selectedYear,
}: UseShiftStatsOptions): Stats {
    return useMemo(() => {
        if (!allShifts || allShifts.length === 0) {
            return {
                totalAmount: 0,
                totalMaster: 0,
                totalSalon: 0,
                totalLateMinutes: 0,
                shiftsCount: 0,
            };
        }
        
        // Нормализуем shift_date - обрезаем время, если оно есть
        const normalizedShifts = allShifts.map((s) => {
            let normalizedDate = String(s.shift_date || '');
            normalizedDate = normalizedDate.split('T')[0].split(' ')[0].trim();
            return {
                ...s,
                shift_date: normalizedDate,
            };
        });
        
        const closedShifts = normalizedShifts.filter((s) => s.status === 'closed');
        
        let filtered: typeof closedShifts = [];
        
        if (statsPeriod === 'day') {
            const dayStr = formatInTimeZone(selectedDate, TZ, 'yyyy-MM-dd');
            filtered = closedShifts.filter((s) => s.shift_date === dayStr);
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
        
        const totalAmount = filtered.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        // Итоговая сумма сотрудника = гарантированная сумма (если есть и больше базовой доли) или базовая доля
        const totalMaster = filtered.reduce((sum, s) => {
            const guaranteed = Number(s.guaranteed_amount || 0);
            const masterShare = Number(s.master_share || 0);
            return sum + (guaranteed > masterShare ? guaranteed : masterShare);
        }, 0);
        // Бизнес получает долю от выручки, но вычитает доплату владельца
        const totalSalon = filtered.reduce((sum, s) => {
            const salonShare = Number(s.salon_share || 0);
            const topup = Number(s.topup_amount || 0);
            return sum + salonShare - topup;
        }, 0);
        const totalLateMinutes = filtered.reduce((sum, s) => sum + Number(s.late_minutes || 0), 0);
        
        return {
            totalAmount,
            totalMaster,
            totalSalon,
            totalLateMinutes,
            shiftsCount: filtered.length,
        };
    }, [allShifts, statsPeriod, selectedDate, selectedMonth, selectedYear]);
}

