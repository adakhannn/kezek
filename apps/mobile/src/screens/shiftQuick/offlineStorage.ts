import * as SecureStore from 'expo-secure-store';

import { logDebug, logError } from '../../lib/log';
import type { FinanceData } from './types';

const OFFLINE_QUEUE_KEY = 'shift_offline_queue';
const OFFLINE_CACHE_KEY = 'shift_offline_cache';

export type ShiftOfflineOperation = {
    type: 'open' | 'close' | 'addItem' | 'updateItem' | 'deleteItem';
    data: unknown;
    timestamp: string;
};

function compactQueue(
    queue: ShiftOfflineOperation[],
    operation: ShiftOfflineOperation,
): ShiftOfflineOperation[] {
    const previous = queue.at(-1);
    if (
        previous?.type === operation.type &&
        JSON.stringify(previous.data) === JSON.stringify(operation.data)
    ) {
        return queue;
    }

    if (operation.type === 'addItem' || operation.type === 'updateItem') {
        const lastItemsIndex = queue.findLastIndex(
            (item) => item.type === 'addItem' || item.type === 'updateItem',
        );
        const lastBoundaryIndex = queue.findLastIndex(
            (item) => item.type === 'open' || item.type === 'close',
        );

        if (lastItemsIndex > lastBoundaryIndex) {
            return queue.map((item, index) => (index === lastItemsIndex ? operation : item));
        }
    }

    return [...queue, operation];
}

export async function addToOfflineQueue(operation: ShiftOfflineOperation) {
    try {
        const existing = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
        const queue: ShiftOfflineOperation[] = existing ? JSON.parse(existing) : [];
        const compactedQueue = compactQueue(queue, operation);
        await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(compactedQueue));
        logDebug('ShiftQuickScreen', 'Added to offline queue', { type: operation.type });
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to add to offline queue', error);
        throw error;
    }
}

export async function getOfflineQueue(): Promise<ShiftOfflineOperation[]> {
    try {
        const existing = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
        return existing ? JSON.parse(existing) : [];
    } catch {
        return [];
    }
}

export async function saveOfflineQueue(queue: ShiftOfflineOperation[]) {
    try {
        if (queue.length === 0) {
            await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
            return;
        }

        await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to save offline queue', error);
        throw error;
    }
}

export async function clearOfflineQueue() {
    await saveOfflineQueue([]);
}

export async function saveShiftCache(data: FinanceData) {
    try {
        await SecureStore.setItemAsync(OFFLINE_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to save shift cache', error);
    }
}

export async function getShiftCache(): Promise<FinanceData | null> {
    try {
        const cached = await SecureStore.getItemAsync(OFFLINE_CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
    } catch {
        return null;
    }
}

export async function clearShiftOfflineData(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY),
        SecureStore.deleteItemAsync(OFFLINE_CACHE_KEY),
    ]);
}
