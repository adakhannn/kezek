import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

import type { ShiftItem } from '../types';
import { mergeShiftItemsWithServer, serializeShiftItems } from '../utils/itemLogic';

import type { FinanceData } from './useFinanceData';

type UseFinanceServerSyncOptions = {
    financeData: FinanceData | null;
    isLoading: boolean;
    setLocalItems: React.Dispatch<React.SetStateAction<ShiftItem[]>>;
    setExpandedItems: React.Dispatch<React.SetStateAction<Set<number>>>;
    skipNextSyncRef: MutableRefObject<boolean>;
    savedItemsWithoutIdRef: MutableRefObject<Set<number>>;
    markSaved: (signature: string) => void;
};

export function useFinanceServerSync({
    financeData,
    isLoading,
    setLocalItems,
    setExpandedItems,
    skipNextSyncRef,
    savedItemsWithoutIdRef,
    markSaved,
}: UseFinanceServerSyncOptions) {
    useEffect(() => {
        if (skipNextSyncRef.current) {
            skipNextSyncRef.current = false;
            return;
        }

        if (financeData?.items) {
            const serverItems = financeData.items;
            setLocalItems((currentLocalItems) =>
                mergeShiftItemsWithServer(currentLocalItems, serverItems),
            );

            markSaved(serializeShiftItems(serverItems));

            setExpandedItems((prev) => {
                if (savedItemsWithoutIdRef.current.size > 0 || prev.size > 0) {
                    savedItemsWithoutIdRef.current.clear();
                    return new Set();
                }
                return prev;
            });
            return;
        }

        if (financeData && !isLoading) {
            setLocalItems((currentLocalItems) => {
                const localItemsWithoutId = currentLocalItems.filter((item) => !item.id);
                if (localItemsWithoutId.length === 0) {
                    setExpandedItems(new Set());
                    savedItemsWithoutIdRef.current.clear();
                }
                return localItemsWithoutId;
            });
        }
    }, [
        financeData,
        financeData?.items,
        isLoading,
        markSaved,
        savedItemsWithoutIdRef,
        setExpandedItems,
        setLocalItems,
        skipNextSyncRef,
    ]);
}
