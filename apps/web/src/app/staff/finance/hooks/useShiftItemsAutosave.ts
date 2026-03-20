import { useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ShiftItem } from '../types';
import { isAbortError } from '../utils/networkRetry';
import {
    formatShiftItemsDate,
    getShiftItemsJsonErrorMessage,
    getShiftItemsResponseErrorMessage,
    getShiftItemsThrownErrorMessage,
    postShiftItemsRequest,
    shouldRestoreShiftItemsFromError,
} from './shiftItemsApi';
import {
    deduplicateShiftItems,
    filterShiftItemsToSave,
    serializeShiftItems,
} from './shiftItemsHelpers';

import { logError } from '@/lib/log';

type ToastLike = {
    showError: (message: string) => void;
};

type UseShiftItemsAutosaveOptions = {
    items: ShiftItem[];
    isOpen: boolean;
    isInitialLoad: boolean;
    isReadOnly: boolean;
    staffId?: string;
    shiftDate?: Date;
    prevItemsRef: MutableRefObject<string>;
    previousItemsRef: MutableRefObject<ShiftItem[]>;
    restorePreviousItems: () => void;
    onSaveSuccessRef: MutableRefObject<(() => void) | undefined>;
    onSaveErrorRef: MutableRefObject<((error: string) => void) | undefined>;
    toastRef: MutableRefObject<ToastLike>;
    setSavingItems: Dispatch<SetStateAction<boolean>>;
};

export function useShiftItemsAutosave({
    items,
    isOpen,
    isInitialLoad,
    isReadOnly,
    staffId,
    shiftDate,
    prevItemsRef,
    previousItemsRef,
    restorePreviousItems,
    onSaveSuccessRef,
    onSaveErrorRef,
    toastRef,
    setSavingItems,
}: UseShiftItemsAutosaveOptions): void {
    const isSavingRef = useRef(false);
    const saveAbortControllerRef = useRef<AbortController | null>(null);
    const lastSavedItemsRef = useRef<string>('');

    const shiftDateStr = formatShiftItemsDate(shiftDate);

    useEffect(() => {
        prevItemsRef.current = '';
    }, [shiftDateStr]);

    useEffect(() => {
        const shouldBlockSave = isInitialLoad || isReadOnly || (!staffId && !isOpen);
        if (shouldBlockSave) {
            prevItemsRef.current = serializeShiftItems(items);
            return;
        }

        if (items.length === 0) return;

        const itemsToSave = filterShiftItemsToSave(items);
        if (itemsToSave.length === 0) {
            prevItemsRef.current = serializeShiftItems(items);
            return;
        }

        const itemsStr = serializeShiftItems(itemsToSave);
        if (itemsStr === prevItemsRef.current) return;
        if (isSavingRef.current) return;

        if (itemsStr === lastSavedItemsRef.current) {
            prevItemsRef.current = itemsStr;
            return;
        }

        previousItemsRef.current = [...items];
        prevItemsRef.current = itemsStr;

        const abortController = new AbortController();
        saveAbortControllerRef.current?.abort();
        saveAbortControllerRef.current = abortController;

        const saveTimeout = setTimeout(async () => {
            if (abortController.signal.aborted) return;

            const shouldBlockCurrentSave = isReadOnly || (!staffId && !isOpen);
            if (shouldBlockCurrentSave) {
                if (saveAbortControllerRef.current === abortController) {
                    saveAbortControllerRef.current = null;
                }
                return;
            }

            const currentItemsToSave = filterShiftItemsToSave(items);
            if (currentItemsToSave.length === 0) {
                if (saveAbortControllerRef.current === abortController) {
                    saveAbortControllerRef.current = null;
                }
                return;
            }

            const currentItemsStr = serializeShiftItems(currentItemsToSave);
            if (currentItemsStr !== itemsStr || currentItemsStr === lastSavedItemsRef.current) {
                if (saveAbortControllerRef.current === abortController) {
                    saveAbortControllerRef.current = null;
                }
                return;
            }

            const { validateShiftItems } = await import('../utils/validation');
            const validation = validateShiftItems(currentItemsToSave);
            if (!validation.valid) {
                const errorMessages = validation.errors.map(({ index, errors }) => {
                    const item = currentItemsToSave[index];
                    const clientName = item.clientName || `Клиент #${index + 1}`;
                    const errorList = Object.values(errors).filter(Boolean).join(', ');
                    return `${clientName}: ${errorList}`;
                });

                toastRef.current.showError(`Ошибки валидации:\n${errorMessages.join('\n')}`);
                if (saveAbortControllerRef.current === abortController) {
                    saveAbortControllerRef.current = null;
                }
                isSavingRef.current = false;
                setSavingItems(false);
                return;
            }

            isSavingRef.current = true;
            setSavingItems(true);

            try {
                const deduplicatedItems = deduplicateShiftItems(currentItemsToSave);
                if (abortController.signal.aborted) return;

                const response = await postShiftItemsRequest({
                    items: deduplicatedItems,
                    staffId,
                    shiftDate,
                    signal: abortController.signal,
                    retries: 2,
                    baseDelayMs: 500,
                    maxDelayMs: 5000,
                    scope: 'ShiftItemsAutoSave',
                });

                if (abortController.signal.aborted) return;

                if (!response.ok) {
                    const errorMessage = await getShiftItemsResponseErrorMessage(response, 'save');
                    prevItemsRef.current = serializeShiftItems(previousItemsRef.current);
                    restorePreviousItems();

                    if (shouldRestoreShiftItemsFromError(errorMessage)) {
                        onSaveErrorRef.current?.(errorMessage);
                        return;
                    }

                    logError('ShiftItems', 'Error auto-saving items', {
                        error: errorMessage,
                        status: response.status,
                    });
                    onSaveErrorRef.current?.(errorMessage);
                    return;
                }

                if (abortController.signal.aborted) return;

                const json = await response.json();
                if (abortController.signal.aborted) return;

                if (!json.ok) {
                    const errorMessage = getShiftItemsJsonErrorMessage(json, 'save');
                    prevItemsRef.current = serializeShiftItems(previousItemsRef.current);
                    restorePreviousItems();

                    if (shouldRestoreShiftItemsFromError(errorMessage)) {
                        onSaveErrorRef.current?.(errorMessage);
                        return;
                    }

                    logError('ShiftItems', 'Error auto-saving items', json.error);
                    onSaveErrorRef.current?.(errorMessage);
                    return;
                }

                lastSavedItemsRef.current = currentItemsStr;
                setTimeout(() => {
                    if (!abortController.signal.aborted) {
                        onSaveSuccessRef.current?.();
                    }
                }, 100);
            } catch (error) {
                if (isAbortError(error)) {
                    if (saveAbortControllerRef.current === abortController) {
                        saveAbortControllerRef.current = null;
                    }
                    return;
                }

                prevItemsRef.current = serializeShiftItems(previousItemsRef.current);
                restorePreviousItems();

                const errorMessage = getShiftItemsThrownErrorMessage(error, 'save');
                if (error instanceof Error && error.name === 'RateLimitError') {
                    onSaveErrorRef.current?.(errorMessage);
                    logError('ShiftItems', 'Rate limit exceeded during auto-save', error);
                    return;
                }

                logError('ShiftItems', 'Error auto-saving items', error);
                onSaveErrorRef.current?.(errorMessage);
            } finally {
                isSavingRef.current = false;
                setSavingItems(false);
                if (saveAbortControllerRef.current === abortController) {
                    saveAbortControllerRef.current = null;
                }
            }
        }, 1000);

        return () => {
            clearTimeout(saveTimeout);
            if (saveAbortControllerRef.current === abortController) {
                abortController.abort();
                saveAbortControllerRef.current = null;
            }
        };
    }, [
        isInitialLoad,
        isOpen,
        isReadOnly,
        items,
        onSaveErrorRef,
        onSaveSuccessRef,
        previousItemsRef,
        restorePreviousItems,
        setSavingItems,
        shiftDate,
        staffId,
        toastRef,
    ]);
}
