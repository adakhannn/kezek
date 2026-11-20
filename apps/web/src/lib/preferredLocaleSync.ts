'use client';

/**
 * Saves the site language as the signed-in user's notification language (FE-10).
 *
 * POST /api/profile/locale stores it in profiles.preferred_locale. Best effort and fire-and-forget:
 * a failure never blocks the language switch, and a 401 (signed out) is ignored.
 * - savePreferredLocale: an explicit choice in the language switcher; sent unless the session is
 *   known to be signed out.
 * - syncPreferredLocaleForUser: called by the auth listener for the session user (on load and after
 *   sign-in); sends only when this browser has not yet saved this language for this user, so a page
 *   load normally costs one localStorage read.
 */
type Locale = 'ru' | 'ky' | 'en';

const ROUTE = '/api/profile/locale';
/** `${userId}:${locale}` of the last successful save from this browser. */
const MARKER_KEY = 'kezek_locale_saved';

/** undefined until the auth listener reports the session; null when signed out. */
let sessionUserId: string | null | undefined;
let inFlight: string | null = null;

function readMarker(): string | null {
    try {
        return window.localStorage.getItem(MARKER_KEY);
    } catch {
        return null;
    }
}

function writeMarker(value: string) {
    try {
        window.localStorage.setItem(MARKER_KEY, value);
    } catch {
        // Without storage the language is sent again on the next load; nothing breaks.
    }
}

async function send(locale: Locale, userId: string | null | undefined): Promise<void> {
    const key = `${userId ?? '?'}:${locale}`;
    if (inFlight === key) return;
    inFlight = key;
    try {
        const response = await fetch(ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            keepalive: true,
            body: JSON.stringify({ locale }),
        });
        if (response.ok && userId) writeMarker(`${userId}:${locale}`);
    } catch {
        // Offline or blocked: the next load or sign-in tries again.
    } finally {
        if (inFlight === key) inFlight = null;
    }
}

/** An explicit language choice. */
export function savePreferredLocale(locale: Locale): void {
    if (typeof window === 'undefined' || sessionUserId === null) return;
    void send(locale, sessionUserId);
}

/** The session user (null when signed out) and the current site language. */
export function syncPreferredLocaleForUser(userId: string | null, locale: Locale | null): void {
    if (typeof window === 'undefined') return;
    sessionUserId = userId;
    if (!userId || !locale) return;
    if (readMarker() === `${userId}:${locale}`) return;
    void send(locale, userId);
}

/** Test helper: forget the session state of this module. */
export function resetPreferredLocaleSyncForTests(): void {
    sessionUserId = undefined;
    inFlight = null;
}
