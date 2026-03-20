import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ShiftItem } from '../types';
import { serializeShiftItems } from './shiftItemsHelpers';

type UseShiftItemsSyncOptions = {
    initialItems: ShiftItem[];
    isInitialLoad: boolean;
    prevItemsRef: MutableRefObject<string>;
    setItems: Dispatch<SetStateAction<ShiftItem[]>>;
};

export function useShiftItemsSync({
    initialItems,
    isInitialLoad,
    prevItemsRef,
    setItems,
}: UseShiftItemsSyncOptions): void {
    useEffect(() => {
        if (isInitialLoad || initialItems.length === 0) {
            setItems(initialItems);
            if (isInitialLoad) {
                prevItemsRef.current = serializeShiftItems(initialItems);
            }
            return;
        }

        setItems((prevItems) => {
            const merged = mergeShiftItems(initialItems, prevItems);
            const mergedStr = serializeShiftItems(merged);

            setTimeout(() => {
                prevItemsRef.current = mergedStr;
            }, 0);

            return merged;
        });
    }, [initialItems, isInitialLoad, prevItemsRef, setItems]);
}

export function mergeShiftItems(
    loadedItems: ShiftItem[],
    localItems: ShiftItem[]
): ShiftItem[] {
    const loadedById = new Map<string, ShiftItem>();
    const loadedWithoutId: ShiftItem[] = [];

    for (const item of loadedItems) {
        if (item.id) {
            loadedById.set(item.id, item);
        } else {
            loadedWithoutId.push(item);
        }
    }

    const localById = new Map<string, ShiftItem>();
    const localWithoutId: ShiftItem[] = [];

    for (const item of localItems) {
        if (item.id) {
            localById.set(item.id, item);
        } else {
            localWithoutId.push(item);
        }
    }

    const merged: ShiftItem[] = [];

    for (const loadedItem of loadedItems) {
        if (!loadedItem.id) continue;

        const localItem = localById.get(loadedItem.id);
        if (localItem) {
            merged.push({
                ...localItem,
                createdAt: loadedItem.createdAt || localItem.createdAt,
            });
            continue;
        }

        merged.push(loadedItem);
    }

    for (const localItem of localWithoutId) {
        const match = findMatchingLoadedItem(localItem, loadedById, loadedWithoutId);

        if (match?.id) {
            const alreadyAdded = merged.some((item) => item.id === match.id);
            if (!alreadyAdded) {
                merged.push({
                    ...localItem,
                    id: match.id,
                    createdAt: match.createdAt || localItem.createdAt,
                });
            }
            continue;
        }

        merged.push(localItem);
    }

    return sortShiftItems(merged);
}

function findMatchingLoadedItem(
    localItem: ShiftItem,
    loadedById: Map<string, ShiftItem>,
    loadedWithoutId: ShiftItem[]
): ShiftItem | undefined {
    const localCreatedAt = localItem.createdAt ? new Date(localItem.createdAt).getTime() : 0;
    const allLoadedItems = [...Array.from(loadedById.values()), ...loadedWithoutId];

    return allLoadedItems.find((loadedItem) => {
        if (loadedItem.clientName !== localItem.clientName) return false;
        if (!loadedItem.createdAt || !localItem.createdAt) return false;

        const loadedCreatedAt = new Date(loadedItem.createdAt).getTime();
        return Math.abs(loadedCreatedAt - localCreatedAt) < 5000;
    });
}

function sortShiftItems(items: ShiftItem[]): ShiftItem[] {
    return [...items].sort((a, b) => {
        if (!a.createdAt && !b.createdAt) {
            if (!a.id && !b.id) return 0;
            if (!a.id) return 1;
            if (!b.id) return -1;
            return b.id.localeCompare(a.id);
        }

        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;

        const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (Math.abs(timeDiff) < 1000) {
            if (!a.id && !b.id) return 0;
            if (!a.id) return 1;
            if (!b.id) return -1;
            return b.id.localeCompare(a.id);
        }

        return timeDiff;
    });
}
