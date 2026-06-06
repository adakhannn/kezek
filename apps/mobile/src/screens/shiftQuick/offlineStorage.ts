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

export async function addToOfflineQueue(operation: ShiftOfflineOperation) {
    try {
        const existing = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
        const queue: ShiftOfflineOperation[] = existing ? JSON.parse(existing) : [];
        queue.push(operation);
        await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        logDebug('ShiftQuickScreen', 'Added to offline queue', { type: operation.type });
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to add to offline queue', error);
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
