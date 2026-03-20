import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { ShiftItem } from '../types';
import { validateShiftItem } from '../utils/validation';

type ToastLike = {
    showError: (message: string) => void;
};

type UseFinanceLocalItemsOptions = {
    serverItems?: ShiftItem[] | null;
    hasFinanceData: boolean;
    isLoading: boolean;
    saveItems: (items: ShiftItem[]) => Promise<unknown>;
    t: (key: string, fallback?: string) => string;
    toast: ToastLike;
};

export function useFinanceLocalItems({
    serverItems,
    hasFinanceData,
    isLoading,
    saveItems,
    t,
    toast,
}: UseFinanceLocalItemsOptions) {
    const [localItems, setLocalItems] = useState<ShiftItem[]>([]);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const savedItemsWithoutIdRef = useRef<Set<number>>(new Set());
    const skipNextSyncRef = useRef(false);

    useEffect(() => {
        if (skipNextSyncRef.current) {
            skipNextSyncRef.current = false;
            return;
        }

        if (serverItems) {
            setLocalItems((currentLocalItems) => {
                const localItemsWithoutId = currentLocalItems.filter((item) => !item.id);
                const localItemsById = new Map(currentLocalItems.filter((item) => item.id).map((item) => [item.id!, item]));
                const mergedItems: ShiftItem[] = [];

                for (const serverItem of serverItems) {
                    if (!serverItem.id) continue;

                    const localItem = localItemsById.get(serverItem.id);
                    if (localItem) {
                        mergedItems.push({
                            id: serverItem.id,
                            clientName: (localItem.clientName && localItem.clientName.trim()) || serverItem.clientName || '',
                            serviceName: (localItem.serviceName && localItem.serviceName.trim()) || serverItem.serviceName || '',
                            serviceAmount: localItem.serviceAmount ?? serverItem.serviceAmount ?? 0,
                            consumablesAmount: localItem.consumablesAmount ?? serverItem.consumablesAmount ?? 0,
                            bookingId: localItem.bookingId ?? serverItem.bookingId ?? null,
                            createdAt: localItem.createdAt || serverItem.createdAt || null,
                        });
                    } else {
                        mergedItems.push(serverItem);
                    }
                }

                for (const localItemWithoutId of localItemsWithoutId) {
                    const isOnServer = serverItems.some((serverItem) => {
                        if (!serverItem.id) return false;
                        return (
                            serverItem.clientName === localItemWithoutId.clientName &&
                            serverItem.serviceName === localItemWithoutId.serviceName &&
                            serverItem.serviceAmount === localItemWithoutId.serviceAmount &&
                            serverItem.consumablesAmount === localItemWithoutId.consumablesAmount &&
                            serverItem.bookingId === localItemWithoutId.bookingId &&
                            serverItem.createdAt === localItemWithoutId.createdAt
                        );
                    });

                    if (!isOnServer) {
                        mergedItems.push(localItemWithoutId);
                    }
                }

                return mergedItems;
            });

            setExpandedItems((prev) => {
                if (savedItemsWithoutIdRef.current.size > 0 || prev.size > 0) {
                    savedItemsWithoutIdRef.current.clear();
                    return new Set();
                }
                return prev;
            });
        } else if (hasFinanceData && !isLoading) {
            setLocalItems((currentLocalItems) => {
                const localItemsWithoutId = currentLocalItems.filter((item) => !item.id);
                if (localItemsWithoutId.length === 0) {
                    setExpandedItems(new Set());
                    savedItemsWithoutIdRef.current.clear();
                }
                return localItemsWithoutId;
            });
        }
    }, [serverItems, hasFinanceData, isLoading]);

    const handleAddClient = useCallback(() => {
        const clientLabel = t('staff.finance.clients.client', 'Клиент');

        setLocalItems((prev) => {
            const existingClients = prev.filter((item) => !item.bookingId && item.clientName?.startsWith(`${clientLabel} `));
            const existingIndices = existingClients
                .map((item) => {
                    const escapedLabel = clientLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`^${escapedLabel} (\\d+)$`);
                    const match = item.clientName?.match(regex);
                    return match ? Number(match[1]) : 0;
                })
                .filter((value) => value > 0);
            const maxIndex = existingIndices.length > 0 ? Math.max(...existingIndices) : 0;
            const nextIndex = maxIndex + 1;

            const now = Date.now();
            const lastItemTime = prev.length > 0 && prev[0].createdAt ? new Date(prev[0].createdAt).getTime() : now;
            const timeOffset = now - lastItemTime < 1000 ? 100 : 0;
            const createdAt = new Date(now + timeOffset).toISOString();

            const newItem: ShiftItem = {
                clientName: `${clientLabel} ${nextIndex}`,
                serviceName: '',
                serviceAmount: 0,
                consumablesAmount: 0,
                bookingId: null,
                createdAt,
            };

            skipNextSyncRef.current = true;

            setExpandedItems((expanded) => {
                const next = new Set<number>([0]);
                expanded.forEach((idx) => next.add(idx + 1));
                return next;
            });

            return [newItem, ...prev];
        });
    }, [t]);

    const handleUpdateItem = useCallback((idx: number, item: ShiftItem) => {
        setLocalItems((prev) => prev.map((existing, index) => (index === idx ? item : existing)));
    }, []);

    const handleSaveItem = useCallback(
        async (idx: number) => {
            const item = localItems[idx];
            if (!item) return;

            const validation = validateShiftItem(item);
            if (!validation.valid) {
                const errorMessages = Object.values(validation.errors).filter(Boolean);
                if (errorMessages.length > 0) {
                    toast.showError(errorMessages[0]);
                } else {
                    toast.showError(t('staff.finance.clients.validationError', 'Обнаружены ошибки валидации'));
                }
                return;
            }

            const hasData =
                item.id ||
                item.bookingId ||
                (item.serviceAmount && item.serviceAmount > 0) ||
                (item.consumablesAmount && item.consumablesAmount > 0) ||
                (item.serviceName && item.serviceName.trim() !== '') ||
                (item.clientName && item.clientName.trim() !== '' && !item.clientName.match(/^Клиент \d+$/));

            if (!hasData) {
                setExpandedItems((prev) => {
                    const next = new Set(prev);
                    next.delete(idx);
                    return next;
                });
                return;
            }

            try {
                const wasNewItem = !item.id;
                if (wasNewItem) {
                    savedItemsWithoutIdRef.current.add(idx);
                }

                await saveItems(localItems);

                setExpandedItems((prev) => {
                    const next = new Set(prev);
                    next.delete(idx);
                    return next;
                });
            } catch {
                savedItemsWithoutIdRef.current.delete(idx);
            }
        },
        [localItems, saveItems, t, toast]
    );

    const handleDeleteItem = useCallback(
        async (idx: number) => {
            const itemToDelete = localItems[idx];

            setLocalItems((prev) => prev.filter((_, index) => index !== idx));
            setExpandedItems((prev) => {
                const next = new Set(prev);
                next.delete(idx);
                return new Set(Array.from(next).map((index) => (index > idx ? index - 1 : index)));
            });

            try {
                const updatedItems = localItems.filter((_, index) => index !== idx);
                await saveItems(updatedItems);
            } catch {
                setLocalItems((prev) => {
                    const result = [...prev];
                    result.splice(idx, 0, itemToDelete);
                    return result;
                });
            }
        },
        [localItems, saveItems]
    );

    const handleDuplicateItem = useCallback(
        (idx: number) => {
            const itemToDuplicate = localItems[idx];
            if (!itemToDuplicate) return;

            const now = Date.now();
            const lastItemTime = localItems.length > 0 && localItems[0].createdAt ? new Date(localItems[0].createdAt).getTime() : now;
            const timeOffset = now - lastItemTime < 1000 ? 100 : 0;
            const createdAt = new Date(now + timeOffset).toISOString();

            const duplicatedItem: ShiftItem = {
                clientName: itemToDuplicate.clientName || '',
                serviceName: itemToDuplicate.serviceName || '',
                serviceAmount: itemToDuplicate.serviceAmount ?? 0,
                consumablesAmount: itemToDuplicate.consumablesAmount ?? 0,
                bookingId: null,
                createdAt,
            };

            setLocalItems((prev) => {
                const result = [...prev];
                result.splice(idx + 1, 0, duplicatedItem);
                return result;
            });

            setExpandedItems((prev) => {
                const shifted = Array.from(prev).map((index) => (index > idx ? index + 1 : index));
                shifted.push(idx + 1);
                return new Set(shifted);
            });

            skipNextSyncRef.current = true;
        },
        [localItems]
    );

    return {
        localItems,
        expandedItems,
        setExpandedItems: setExpandedItems as Dispatch<SetStateAction<Set<number>>>,
        handleAddClient,
        handleUpdateItem,
        handleSaveItem,
        handleDeleteItem,
        handleDuplicateItem,
    };
}
