import * as SecureStore from 'expo-secure-store';

import { clearShiftCache, clearShiftOfflineData } from '../screens/shiftQuick/offlineStorage';
import { TRANSIENT_AUTH_STORAGE_KEYS } from './authStorageKeys';
import { clearOfflineBookings } from './offlineBookingsStorage';
import { clearPushRegistrationRecord } from './pushNotifications';
import { queryClient } from './queryClient';
import { clearStaffSelection } from './staffSelectionStorage';

/**
 * What the sign-out button removes (signOut.ts): the whole shift queue, after the
 * confirmation has named the unsent changes, and any half-finished sign-in flow. The push token
 * was already removed on the server while the session existed; here its local record goes.
 */
export async function clearLocalStateOnSignOut(userId?: string): Promise<void> {
    await Promise.all([
        ...TRANSIENT_AUTH_STORAGE_KEYS.map((key) => SecureStore.deleteItemAsync(key)),
        clearPushRegistrationRecord(),
        clearShiftOfflineData(),
        clearAccountCaches(userId),
    ]);
    queryClient.clear();
}

/**
 * The session ended without the button (token revoked or expired, sign-out on the web) or
 * another account replaced it (R25-05): the next account must not see the previous one's
 * cached user, role, businesses, finances or bookings. Nobody confirmed anything, so the unsent
 * shift queue stays (each operation carries its owner and is sent only for that account), and
 * the sign-in flow keys stay too: they belong to the sign-in in progress, not to the old account.
 * Without a session the push token cannot be removed on the server: only its local record goes
 * (the next account's registration moves the token to that account).
 */
export async function clearLocalStateOnSessionEnd(previousUserId?: string): Promise<void> {
    queryClient.clear();
    await Promise.all([clearShiftCache(), clearAccountCaches(previousUserId), clearPushRegistrationRecord()]);
}

async function clearAccountCaches(userId?: string): Promise<void> {
    if (!userId) return;
    await Promise.all([clearOfflineBookings(userId), clearStaffSelection(userId)]);
}
