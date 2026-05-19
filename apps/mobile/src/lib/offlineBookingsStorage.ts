import * as SecureStore from 'expo-secure-store';

import { logDebug, logError, logWarn } from './log';

const BOOKINGS_KEY_PREFIX = 'offline:bookings:';
const SECURE_STORE_CHUNK_SIZE = 1800;
const SECURE_STORE_META_SUFFIX = '__chunks_meta';
const SECURE_STORE_CHUNK_SUFFIX = '__chunk_';

export type OfflineBookingStatus = 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';

export type OfflineBooking = {
    id: string;
    status: OfflineBookingStatus;
    start_at: string;
    end_at: string;
    branch_name?: string | null;
    service_name?: string | null;
    staff_name?: string | null;
    business_name?: string | null;
    created_at: string;
};

export type OfflineBookingsPayload = {
    userId: string;
    updatedAt: string;
    items: OfflineBooking[];
};

function getBookingsKey(userId: string): string {
    return `${BOOKINGS_KEY_PREFIX}${userId}`;
}

function getMetaKey(key: string): string {
    return `${key}${SECURE_STORE_META_SUFFIX}`;
}

function getChunkKey(key: string, index: number): string {
    return `${key}${SECURE_STORE_CHUNK_SUFFIX}${index}`;
}

async function clearChunkEntries(key: string, chunkCount: number): Promise<void> {
    if (!Number.isInteger(chunkCount) || chunkCount <= 0) {
        await SecureStore.deleteItemAsync(getMetaKey(key));
        return;
    }

    for (let i = 0; i < chunkCount; i += 1) {
        await SecureStore.deleteItemAsync(getChunkKey(key, i));
    }
    await SecureStore.deleteItemAsync(getMetaKey(key));
}

async function readChunkedValue(key: string): Promise<string | null> {
    const metaRaw = await SecureStore.getItemAsync(getMetaKey(key));
    if (!metaRaw) {
        return null;
    }

    const chunkCount = Number(metaRaw);
    if (!Number.isInteger(chunkCount) || chunkCount <= 0) {
        await clearChunkEntries(key, 0);
        return null;
    }

    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i += 1) {
        const chunk = await SecureStore.getItemAsync(getChunkKey(key, i));
        if (chunk == null) {
            logWarn('offlineBookingsStorage', 'Chunked payload is incomplete, fallback to single-key cache', {
                key,
                missingChunkIndex: i,
                chunkCount,
            });
            return null;
        }
        chunks.push(chunk);
    }

    return chunks.join('');
}

export async function saveOfflineBookings(payload: OfflineBookingsPayload): Promise<void> {
    try {
        const key = getBookingsKey(payload.userId);
        const serialized = JSON.stringify(payload);

        if (serialized.length <= SECURE_STORE_CHUNK_SIZE) {
            await SecureStore.setItemAsync(key, serialized);
            const staleMetaRaw = await SecureStore.getItemAsync(getMetaKey(key));
            const staleChunkCount = Number(staleMetaRaw || 0);
            await clearChunkEntries(key, staleChunkCount);
        } else {
            const chunks: string[] = [];
            for (let i = 0; i < serialized.length; i += SECURE_STORE_CHUNK_SIZE) {
                chunks.push(serialized.slice(i, i + SECURE_STORE_CHUNK_SIZE));
            }

            for (let i = 0; i < chunks.length; i += 1) {
                await SecureStore.setItemAsync(getChunkKey(key, i), chunks[i]);
            }

            await SecureStore.setItemAsync(getMetaKey(key), String(chunks.length));
            await SecureStore.deleteItemAsync(key);
        }

        logDebug('offlineBookingsStorage', 'Saved offline bookings', {
            userId: payload.userId,
            count: payload.items.length,
        });
    } catch (error) {
        logError('offlineBookingsStorage', 'Failed to save offline bookings', error);
    }
}

export async function loadOfflineBookings(userId: string): Promise<OfflineBookingsPayload | null> {
    try {
        const key = getBookingsKey(userId);
        const chunkedRaw = await readChunkedValue(key);
        const raw = chunkedRaw ?? (await SecureStore.getItemAsync(key));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as OfflineBookingsPayload;
        logDebug('offlineBookingsStorage', 'Loaded offline bookings', {
            userId,
            count: parsed.items?.length ?? 0,
        });
        return parsed;
    } catch (error) {
        logError('offlineBookingsStorage', 'Failed to load offline bookings', error);
        return null;
    }
}

