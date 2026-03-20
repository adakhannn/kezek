import * as SecureStore from 'expo-secure-store';

import type { FinanceData, OfflineOperation } from './types';

import { logDebug, logError } from '../../lib/log';

const OFFLINE_QUEUE_KEY = 'shift_offline_queue';
const OFFLINE_CACHE_KEY = 'shift_offline_cache';

export async function addToOfflineQueue(operation: OfflineOperation) {
    try {
        const existing = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
        const queue = existing ? JSON.parse(existing) : [];
        queue.push(operation);
        await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        logDebug('ShiftQuickScreen', 'Added to offline queue', { type: operation.type });
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to add to offline queue', error);
    }
}

export async function getOfflineQueue(): Promise<OfflineOperation[]> {
    try {
        const existing = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
        return existing ? JSON.parse(existing) : [];
    } catch {
        return [];
    }
}

export async function clearOfflineQueue() {
    try {
        await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to clear offline queue', error);
    }
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
