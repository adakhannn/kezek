import * as SecureStore from 'expo-secure-store';

import { logWarn } from './log';

/**
 * Staff card (business) chosen in the staff workspace by a person who is an active master in
 * several businesses (ARCH-02). One value per account on this device; sign-out deletes it.
 */
const STAFF_SELECTION_KEY_PREFIX = 'kezek_staff_selection_';

/**
 * Header that names the staff card a `/api/staff/*` request acts as. Without it the server
 * uses the only active card and asks a person with several cards to choose (HTTP 400,
 * STAFF_SELECTION_REQUIRED).
 */
export const STAFF_ID_HEADER = 'x-kezek-staff-id';

export function staffSelectionKey(userId: string): string {
    return `${STAFF_SELECTION_KEY_PREFIX}${userId}`;
}

/** The remembered staff card id, or null when nothing is stored or the store cannot be read. */
export async function getStaffSelection(userId: string): Promise<string | null> {
    try {
        const value = await SecureStore.getItemAsync(staffSelectionKey(userId));
        return typeof value === 'string' && value.length > 0 ? value : null;
    } catch (error) {
        logWarn('staffSelection', 'Failed to read the chosen staff card', error);
        return null;
    }
}

export async function setStaffSelection(userId: string, staffId: string): Promise<void> {
    await SecureStore.setItemAsync(staffSelectionKey(userId), staffId);
}

export async function clearStaffSelection(userId: string): Promise<void> {
    await SecureStore.deleteItemAsync(staffSelectionKey(userId));
}
