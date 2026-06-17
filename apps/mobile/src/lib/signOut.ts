import * as SecureStore from 'expo-secure-store';

import { clearShiftOfflineData } from '../screens/shiftQuick/offlineStorage';
import { TRANSIENT_AUTH_STORAGE_KEYS } from './authStorageKeys';
import { logWarn } from './log';
import { clearOfflineBookings } from './offlineBookingsStorage';
import { queryClient } from './queryClient';
import { supabase } from './supabase';

type AuthWithLocalSessionRemoval = {
    getSession: () => Promise<{
        data: { session: { user?: { id?: string } } | null };
        error: Error | null;
    }>;
    signOut: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<{ error: Error | null }>;
    _removeSession?: () => Promise<void>;
};

const REMOTE_SIGN_OUT_TIMEOUT_MS = 4000;

export type SignOutResult = {
    usedLocalFallback: boolean;
};

async function removeLocalSession(auth: AuthWithLocalSessionRemoval): Promise<void> {
    try {
        const { error } = await auth.signOut({ scope: 'local' });
        if (!error) {
            return;
        }
    } catch {
        // Older Supabase clients may not support local scope.
    }

    if (!auth._removeSession) {
        throw new Error('Unable to clear local auth session');
    }

    await auth._removeSession();
}

async function clearSensitiveLocalState(userId?: string): Promise<void> {
    await Promise.all([
        ...TRANSIENT_AUTH_STORAGE_KEYS.map((key) => SecureStore.deleteItemAsync(key)),
        clearShiftOfflineData(),
        userId ? clearOfflineBookings(userId) : Promise.resolve(),
    ]);
    queryClient.clear();
}

export async function signOutSafely(): Promise<SignOutResult> {
    const auth = supabase.auth as unknown as AuthWithLocalSessionRemoval;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let userId: string | undefined;
    let usedLocalFallback = false;

    try {
        try {
            const {
                data: { session },
            } = await auth.getSession();
            userId = session?.user?.id;
        } catch {
            // Logout must continue even if session inspection fails.
        }

        const { error } = await Promise.race([
            auth.signOut(),
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new Error('Remote sign-out timed out')),
                    REMOTE_SIGN_OUT_TIMEOUT_MS,
                );
            }),
        ]);
        if (error) {
            throw error;
        }
    } catch (error) {
        logWarn('signOut', 'Remote sign-out failed; clearing local session', error);
        await removeLocalSession(auth);
        usedLocalFallback = true;
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }

    await clearSensitiveLocalState(userId);
    return { usedLocalFallback };
}
