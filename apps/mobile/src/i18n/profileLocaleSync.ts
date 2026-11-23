import { apiRequest } from '../lib/api';
import { logDebug } from '../lib/log';
import { supabase } from '../lib/supabase';
import type { Locale } from './locale';

/**
 * Saves the app language as profiles.preferred_locale, the language of the user's notifications,
 * via POST /api/profile/locale with the session's Bearer token (FE-10). Signed out, nothing is
 * sent. Fire-and-forget: it never throws, and a failure only costs the notification language.
 */
export async function saveProfileLocale(locale: Locale): Promise<void> {
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        await apiRequest('/profile/locale', {
            method: 'POST',
            body: JSON.stringify({ locale }),
        });
    } catch (error) {
        logDebug('i18n', 'Failed to save the profile language', { error });
    }
}
