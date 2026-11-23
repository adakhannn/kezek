import * as SecureStore from 'expo-secure-store';

import type { MobileI18nKey } from '../i18n/dictionaries/ru';
import { createTranslate, type Translate } from '../i18n/translate';
import { clearShiftOfflineData, getOfflineQueue } from '../screens/shiftQuick/offlineStorage';
import { TRANSIENT_AUTH_STORAGE_KEYS } from './authStorageKeys';
import { logWarn } from './log';
import { clearOfflineBookings } from './offlineBookingsStorage';
import { queryClient } from './queryClient';
import { clearStaffSelection } from './staffSelectionStorage';
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

const translateRu: Translate = createTranslate('ru');

export type SignOutResult = {
    usedLocalFallback: boolean;
};

/**
 * Shift changes saved offline and not yet sent. Sign-out deletes them with the rest of the
 * account's local data (another account must not inherit them), so the confirmation names
 * them first instead of deleting them silently (MOB-02).
 */
export async function countPendingShiftOperations(): Promise<number | null> {
    try {
        return (await getOfflineQueue()).length;
    } catch {
        // Unreadable or damaged queue: something may be pending; never report it as empty.
        return null;
    }
}

/** The plural form key of "change" for a count (Russian one / few / many; ky and en map them). */
function shiftChangesKey(count: number): MobileI18nKey {
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'cabinet.signOut.changes.many';
    if (last === 1) return 'cabinet.signOut.changes.one';
    if (last >= 2 && last <= 4) return 'cabinet.signOut.changes.few';
    return 'cabinet.signOut.changes.many';
}

/** The sign-out confirmation in the screen's language (`t` from `useLanguage()`); Russian without `t`. */
export function signOutConfirmationText(pendingShiftOperations: number | null, t: Translate = translateRu): {
    title: string;
    message: string;
    confirmLabel: string;
} {
    if (pendingShiftOperations === null) {
        return {
            title: t('cabinet.signOut.unknown.title'),
            message: t('cabinet.signOut.unknown.message'),
            confirmLabel: t('cabinet.signOut.confirmDelete'),
        };
    }
    if (pendingShiftOperations > 0) {
        return {
            title: t('cabinet.signOut.pending.title'),
            message: t('cabinet.signOut.pending.message', {
                count: pendingShiftOperations,
                changes: t(shiftChangesKey(pendingShiftOperations)),
            }),
            confirmLabel: t('cabinet.signOut.confirmDelete'),
        };
    }
    return {
        title: t('cabinet.signOut.title'),
        message: t('cabinet.signOut.message'),
        confirmLabel: t('cabinet.signOut.confirm'),
    };
}

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
        userId ? clearStaffSelection(userId) : Promise.resolve(),
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
