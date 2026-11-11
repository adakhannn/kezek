import * as SecureStore from 'expo-secure-store';

import { logDebug, logError } from '../../lib/log';
import type { FinanceData } from './types';
import type { ShiftItemEdit } from './types';

const OFFLINE_QUEUE_KEY = 'shift_offline_queue';
const OFFLINE_CACHE_KEY = 'shift_offline_cache';

export type ShiftOfflineOperation = {
    type: 'open' | 'close' | 'addItem' | 'updateItem' | 'deleteItem';
    data: unknown;
    timestamp: string;
    owner?: ShiftOwner;
    state?: 'pending' | 'review';
    reason?: string;
    edit?: Pick<ShiftItemEdit, 'item' | 'itemId'>;
};

export type ShiftOwner = { userId: string; staffId: string };

export function ownsOperation(operation: ShiftOfflineOperation, owner: ShiftOwner): boolean {
    return operation.owner?.userId === owner.userId && operation.owner.staffId === owner.staffId;
}

function compactQueue(
    queue: ShiftOfflineOperation[],
    operation: ShiftOfflineOperation,
): ShiftOfflineOperation[] {
    const previous = queue.at(-1);
    if (
        previous?.type === operation.type &&
        JSON.stringify(previous.data) === JSON.stringify(operation.data) &&
        JSON.stringify(previous.owner) === JSON.stringify(operation.owner) &&
        previous.state === operation.state
    ) {
        return queue;
    }

    // Different snapshots are separate commands. Compacting them silently loses drafts
    // and can substitute a different revision or owner for a command already sent.
    return [...queue, operation];
}

export async function addToOfflineQueue(operation: ShiftOfflineOperation) {
    try {
        const queue = await getOfflineQueue();
        const compactedQueue = compactQueue(queue, operation);
        await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(compactedQueue));
        logDebug('ShiftQuickScreen', 'Added to offline queue', { type: operation.type });
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to add to offline queue', error);
        throw error;
    }
}

export async function getOfflineQueue(): Promise<ShiftOfflineOperation[]> {
    const existing = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
    const queue: unknown = existing ? JSON.parse(existing) : [];
    if (!Array.isArray(queue) || queue.some(item => !item || typeof item !== 'object'
        || typeof item.type !== 'string' || typeof item.timestamp !== 'string' || !('data' in item))) {
        throw new Error('Не удалось прочитать сохранённые операции. Отправка остановлена, данные не удалены.');
    }
    return queue;
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

export async function saveShiftCache(data: FinanceData, owner: ShiftOwner) {
    try {
        await SecureStore.setItemAsync(OFFLINE_CACHE_KEY, JSON.stringify({ owner, data }));
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to save shift cache', error);
    }
}

export async function getShiftCache(owner: ShiftOwner): Promise<FinanceData | null> {
    try {
        const cached = await SecureStore.getItemAsync(OFFLINE_CACHE_KEY);
        const value = cached ? JSON.parse(cached) : null;
        return value?.owner?.userId === owner.userId && value.owner.staffId === owner.staffId
            && value.data?.today ? value.data : null;
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
