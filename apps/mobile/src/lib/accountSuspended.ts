import { Alert } from 'react-native';

import { getRequestLocale } from '../i18n/locale';
import { createTranslate } from '../i18n/translate';
import { logWarn } from './log';
import { supabase } from './supabase';

const NOTICE_DEDUP_MS = 10_000;
let lastNoticeAt = 0;

/**
 * A blocked account (KEZEK-MOBILE-2) answered a session grant or refresh. Retrying cannot help, so
 * this device signs out locally (the SDK would otherwise keep the stored session and retry the
 * refresh, since it treats the 500 as retryable) and the user is told why, once, in the app language.
 * Expected for a moderated account: a warning, not an error report.
 */
export async function endSuspendedSession(context: string, error: unknown): Promise<void> {
    logWarn(context, 'Account is blocked; signing out on this device', error);
    try {
        await supabase.auth.signOut({ scope: 'local' });
    } catch (signOutError) {
        logWarn(context, 'Local sign-out of a blocked account failed', signOutError);
    }
    showAccountSuspendedNotice();
}

export function showAccountSuspendedNotice(): void {
    const now = Date.now();
    if (now - lastNoticeAt < NOTICE_DEDUP_MS) return;
    lastNoticeAt = now;
    const t = createTranslate(getRequestLocale());
    Alert.alert(t('auth.error.accountSuspended.title'), t('auth.error.accountSuspended'));
}

/** Tests only: forget the last notice. */
export function resetAccountSuspendedNoticeForTests(): void {
    lastNoticeAt = 0;
}
