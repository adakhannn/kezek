import { useCallback, useMemo } from 'react';

import type { PeriodKey, ShiftItem } from '../types';
import { collapseItem, expandItem, serializeShiftItems } from '../utils/itemLogic';

import type { FinanceData } from './useFinanceData';
import { useServiceOptions } from './useServiceOptions';
import { useShiftStats } from './useShiftStats';

type UseFinancePageDerivedStateOptions = {
    financeData: FinanceData | null;
    localItems: ShiftItem[];
    setExpandedItems: React.Dispatch<React.SetStateAction<Set<number>>>;
    lastSavedSignature: string | null;
    staffId?: string;
    statsPeriod: PeriodKey;
    selectedDate: Date;
    selectedMonth: Date;
    selectedYear: number;
};

export function useFinancePageDerivedState({
    financeData,
    localItems,
    setExpandedItems,
    lastSavedSignature,
    staffId,
    statsPeriod,
    selectedDate,
    selectedMonth,
    selectedYear,
}: UseFinancePageDerivedStateOptions) {
    const shift = financeData?.shift ?? null;
    const todayStatus = financeData?.todayStatus ?? 'none';
    const isOpen = todayStatus === 'open';
    const isClosed = todayStatus === 'closed';
    const isReadOnlyForOwner = !!staffId && isClosed;

    const stats = useShiftStats({
        allShifts: financeData?.allShifts ?? [],
        statsPeriod,
        selectedDate,
        selectedMonth,
        selectedYear,
    });

    const serviceOptions = useServiceOptions(
        financeData?.services ?? [],
        financeData?.bookings ?? [],
        localItems,
    );

    const allClosedShiftsCount = useMemo(() => {
        const allShifts = financeData?.allShifts ?? [];
        return allShifts.filter((shiftItem) => shiftItem.status === 'closed').length;
    }, [financeData?.allShifts]);

    const hasUnsavedChanges =
        lastSavedSignature !== null && serializeShiftItems(localItems) !== lastSavedSignature;

    const handleExpandItem = useCallback((idx: number) => {
        setExpandedItems((prev) => expandItem(prev, idx));
    }, [setExpandedItems]);

    const handleCollapseItem = useCallback((idx: number) => {
        setExpandedItems((prev) => collapseItem(prev, idx));
    }, [setExpandedItems]);

    return {
        allClosedShiftsCount,
        handleCollapseItem,
        handleExpandItem,
        hasUnsavedChanges,
        isClosed,
        isOpen,
        isReadOnlyForOwner,
        serviceOptions,
        shift,
        stats,
        todayStatus,
    };
}
