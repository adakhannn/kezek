import * as SecureStore from 'expo-secure-store';

import { logDebug, logError } from './log';

const BOOKINGS_KEY_PREFIX = 'offline:bookings:';

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

export async function saveOfflineBookings(payload: OfflineBookingsPayload): Promise<void> {
    try {
        const key = getBookingsKey(payload.userId);
        await SecureStore.setItemAsync(key, JSON.stringify(payload));
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
        const raw = await SecureStore.getItemAsync(key);
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

