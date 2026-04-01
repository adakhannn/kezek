import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ShiftItem } from '../types';
import {
    collapseItem,
    createNewClientShiftItem,
    duplicateShiftItem,
    hasMeaningfulShiftItemData,
    insertShiftItemAtIndex,
    removeShiftItemAtIndex,
    serializeShiftItems,
    shiftExpandedItemsAfterDelete,
    shiftExpandedItemsAfterInsert,
} from '../utils/itemLogic';
import { validateShiftItem } from '../utils/validation';

type ToastApi = {
    showError: (message: string) => void;
};

type FinanceItemMutations = {
    saveItems: (items: ShiftItem[]) => Promise<void>;
};

type UseFinanceItemActionsOptions = {
    autoClientLabel: string;
    localItems: ShiftItem[];
    setLocalItems: Dispatch<SetStateAction<ShiftItem[]>>;
    setExpandedItems: Dispatch<SetStateAction<Set<number>>>;
    clearPendingSave: () => void;
    markSaved: (signature: string) => void;
    mutations: FinanceItemMutations;
    prepareItemsForSave: (items: ShiftItem[]) => ShiftItem[];
    toast: ToastApi;
    t: (key: string, fallback?: string) => string;
    savedItemsWithoutIdRef: MutableRefObject<Set<number>>;
    skipNextSyncRef: MutableRefObject<boolean>;
    addClientLockRef: MutableRefObject<boolean>;
    addClientUnlockTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
};

export function useFinanceItemActions({
    autoClientLabel,
    localItems,
    setLocalItems,
    setExpandedItems,
    clearPendingSave,
    markSaved,
    mutations,
    prepareItemsForSave,
    toast,
    t,
    savedItemsWithoutIdRef,
    skipNextSyncRef,
    addClientLockRef,
    addClientUnlockTimerRef,
}: UseFinanceItemActionsOptions) {
    const handleAddClient = useCallback(() => {
        if (addClientLockRef.current) return;
        addClientLockRef.current = true;
        if (addClientUnlockTimerRef.current) {
            clearTimeout(addClientUnlockTimerRef.current);
        }
        addClientUnlockTimerRef.current = setTimeout(() => {
            addClientLockRef.current = false;
            addClientUnlockTimerRef.current = null;
        }, 500);

        setLocalItems((prev) => {
            const updatedItems = [createNewClientShiftItem(prev, autoClientLabel), ...prev];
            skipNextSyncRef.current = true;
            return updatedItems;
        });
        setExpandedItems(new Set([0]));
    }, [
        addClientLockRef,
        addClientUnlockTimerRef,
        autoClientLabel,
        setExpandedItems,
        setLocalItems,
        skipNextSyncRef,
    ]);

    const handleUpdateItem = useCallback(
        (idx: number, item: ShiftItem) => {
            setLocalItems((prev) => prev.map((it, i) => (i === idx ? item : it)));
        },
        [setLocalItems],
    );

    const handleSaveItem = useCallback(
        async (idx: number) => {
            const item = localItems[idx];
            if (!item) return;

            const validation = validateShiftItem(item);
            if (!validation.valid) {
                const errorKeys = Object.values(validation.errors).filter(Boolean);
                if (errorKeys.length > 0) {
                    toast.showError(t(errorKeys[0]));
                } else {
                    toast.showError(t('staff.finance.validation.errors'));
                }
                return;
            }

            const hasData = hasMeaningfulShiftItemData(item, {
                autoClientLabel,
            });
            if (!hasData) {
                setExpandedItems((prev) => collapseItem(prev, idx));
                return;
            }

            try {
                clearPendingSave();

                const wasNewItem = !item.id;
                if (wasNewItem) {
                    savedItemsWithoutIdRef.current.add(idx);
                }

                const itemsForSave = prepareItemsForSave(localItems);
                await mutations.saveItems(itemsForSave);
                markSaved(serializeShiftItems(itemsForSave));
                setExpandedItems((prev) => collapseItem(prev, idx));
            } catch {
                savedItemsWithoutIdRef.current.delete(idx);
            }
        },
        [
            autoClientLabel,
            clearPendingSave,
            localItems,
            markSaved,
            mutations,
            prepareItemsForSave,
            savedItemsWithoutIdRef,
            setExpandedItems,
            t,
            toast,
        ],
    );

    const handleDeleteItem = useCallback(
        async (idx: number) => {
            const itemToDelete = localItems[idx];

            setLocalItems((prev) => removeShiftItemAtIndex(prev, idx));
            setExpandedItems((prev) => shiftExpandedItemsAfterDelete(prev, idx));

            try {
                clearPendingSave();

                const updatedItems = prepareItemsForSave(removeShiftItemAtIndex(localItems, idx));
                await mutations.saveItems(updatedItems);
                markSaved(serializeShiftItems(updatedItems));
            } catch {
                setLocalItems((prev) => insertShiftItemAtIndex(prev, idx, itemToDelete));
            }
        },
        [
            clearPendingSave,
            localItems,
            markSaved,
            mutations,
            prepareItemsForSave,
            setExpandedItems,
            setLocalItems,
        ],
    );

    const handleDuplicateItem = useCallback(
        (idx: number) => {
            const itemToDuplicate = localItems[idx];
            if (!itemToDuplicate) return;

            const duplicatedItem = duplicateShiftItem(localItems, itemToDuplicate);
            setLocalItems((prev) => insertShiftItemAtIndex(prev, idx + 1, duplicatedItem));
            setExpandedItems((prev) => shiftExpandedItemsAfterInsert(prev, idx));
            skipNextSyncRef.current = true;
        },
        [localItems, setExpandedItems, setLocalItems, skipNextSyncRef],
    );

    return {
        handleAddClient,
        handleUpdateItem,
        handleSaveItem,
        handleDeleteItem,
        handleDuplicateItem,
    };
}
