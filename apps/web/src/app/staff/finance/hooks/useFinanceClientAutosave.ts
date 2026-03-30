import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import type { ShiftItem, TabKey } from '../types';

import { SAVE_DEBOUNCE_MS } from '@/app/staff/finance/constants';


type SaveItems = (items: ShiftItem[]) => Promise<unknown>;
type SerializeItems = (items: ShiftItem[]) => string;
type PrepareItemsForSave = (items: ShiftItem[]) => ShiftItem[];

type Options = {
    activeTab: TabKey;
    activeTabRef: MutableRefObject<TabKey>;
    previousTabRef: MutableRefObject<TabKey | null>;
    localItems: ShiftItem[];
    isOpen: boolean;
    isReadOnlyForOwner: boolean;
    prepareItemsForSave: PrepareItemsForSave;
    saveItems: SaveItems;
    serializeItems: SerializeItems;
};

export function useFinanceClientAutosave({
    activeTab,
    activeTabRef,
    previousTabRef,
    localItems,
    isOpen,
    isReadOnlyForOwner,
    prepareItemsForSave,
    saveItems,
    serializeItems,
}: Options) {
    const localItemsRef = useRef<ShiftItem[]>([]);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const saveItemsRef = useRef(saveItems);
    const prepareItemsForSaveRef = useRef(prepareItemsForSave);
    const serializeItemsRef = useRef(serializeItems);
    const isOpenRef = useRef(false);
    const isReadOnlyForOwnerRef = useRef(false);
    const lastSavedItemsRef = useRef<string | null>(null);
    const [lastSavedSignature, setLastSavedSignature] = useState<string | null>(null);

    useEffect(() => {
        localItemsRef.current = localItems;
    }, [localItems]);

    saveItemsRef.current = saveItems;
    prepareItemsForSaveRef.current = prepareItemsForSave;
    serializeItemsRef.current = serializeItems;

    isOpenRef.current = isOpen;
    isReadOnlyForOwnerRef.current = isReadOnlyForOwner;

    const clearPendingSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
    }, []);

    const markSaved = useCallback((signature: string) => {
        lastSavedItemsRef.current = signature;
        setLastSavedSignature(signature);
    }, []);

    const handleSaveNow = useCallback(() => {
        if (!isOpen || isReadOnlyForOwner) return;

        const latestItemsRaw = localItemsRef.current;
        const latestItems = prepareItemsForSaveRef.current(latestItemsRaw);
        if (latestItems.length === 0) return;

        const latestSignature = serializeItemsRef.current(latestItems);
        if (lastSavedSignature !== null && latestSignature === lastSavedSignature) {
            return;
        }

        clearPendingSave();

        void saveItemsRef.current(latestItems)
            .then(() => {
                markSaved(latestSignature);
            })
            .catch(() => {
                // Error toast is handled by the mutation layer.
            });
    }, [clearPendingSave, isOpen, isReadOnlyForOwner, lastSavedSignature, markSaved]);

    useEffect(() => {
        if (activeTabRef.current !== 'clients') {
            return;
        }
        if (!isOpen || isReadOnlyForOwner) {
            return;
        }
        if (localItems.length === 0) {
            return;
        }

        const itemsSignature = serializeItemsRef.current(localItems);
        if (itemsSignature === lastSavedItemsRef.current) {
            return;
        }

        clearPendingSave();

        saveTimeoutRef.current = setTimeout(() => {
            if (activeTabRef.current !== 'clients') return;
            if (!isOpenRef.current || isReadOnlyForOwnerRef.current) return;

            const latestItems = prepareItemsForSaveRef.current(localItemsRef.current);
            const latestSignature = serializeItemsRef.current(latestItems);
            if (latestSignature === lastSavedItemsRef.current) return;

            void saveItemsRef.current(latestItems)
                .then(() => {
                    markSaved(latestSignature);
                })
                .catch(() => {
                    // Error toast is handled by the mutation layer.
                });
        }, SAVE_DEBOUNCE_MS);

        return clearPendingSave;
    }, [activeTabRef, clearPendingSave, isOpen, isReadOnlyForOwner, localItems, markSaved]);

    useEffect(() => {
        const wasClients = previousTabRef.current === 'clients';
        previousTabRef.current = activeTab;

        if (wasClients && activeTab !== 'clients') {
            clearPendingSave();
            const latestItems = prepareItemsForSaveRef.current(localItemsRef.current);
            const latestSignature = latestItems.length > 0 ? serializeItemsRef.current(latestItems) : null;

            if (
                latestItems.length > 0 &&
                latestSignature &&
                latestSignature !== lastSavedItemsRef.current &&
                isOpen &&
                !isReadOnlyForOwner
            ) {
                void saveItemsRef.current(latestItems);
            }
        }
    }, [activeTab, clearPendingSave, isOpen, isReadOnlyForOwner, previousTabRef]);

    useEffect(() => {
        return () => {
            const latestItems = prepareItemsForSaveRef.current(localItemsRef.current);
            const latestSignature = latestItems.length > 0 ? serializeItemsRef.current(latestItems) : null;

            if (latestItems.length === 0) return;
            if (!latestSignature || latestSignature === lastSavedItemsRef.current) return;
            if (!isOpenRef.current || isReadOnlyForOwnerRef.current) return;

            void saveItemsRef.current(latestItems);
        };
    }, []);

    return {
        clearPendingSave,
        handleSaveNow,
        lastSavedSignature,
        localItemsRef,
        markSaved,
    };
}
