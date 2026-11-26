import type { User } from '@supabase/supabase-js';

import { supabase } from './supabase';

/**
 * Supabase answers getUser() without a session with an AuthSessionMissingError. The app is usable
 * signed out (browsing, the business page, the booking flow), so for the shared ['user'] query
 * "nobody is signed in" is a null user, not an error to retry or show.
 */
export function isSessionMissingError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const { name, message } = error as { name?: unknown; message?: unknown };
    return name === 'AuthSessionMissingError' || (typeof message === 'string' && /auth session missing/i.test(message));
}

/** The signed-in user, or null when nobody is signed in. Other auth errors are thrown. */
export async function fetchCurrentUser(): Promise<User | null> {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) {
        if (isSessionMissingError(error)) return null;
        throw error;
    }

    return user ?? null;
}
