import { Linking } from 'react-native';

import { apiRequest } from './api';
import { getMobileApiUrl } from './apiUrl';

type WebHandoffResponse = { ok: true; url: string };

/** Only the web app's handoff page may be opened, whatever the response says. */
export function isWebHandoffUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || (__DEV__ && url.protocol === 'http:')) && url.pathname === '/auth/handoff';
    } catch {
        return false;
    }
}

/**
 * Opens `next` on the website in the browser, signed in as the app's user.
 *
 * A one-time code instead of the app's own tokens: nothing long-lived lands in browser history,
 * and the browser gets an independent session rather than sharing (and rotating away) the app's
 * refresh token. Throws when the code cannot be issued or the URL is not the handoff page.
 */
export async function openWebAsCurrentUser(next: string): Promise<void> {
    const response = await apiRequest<WebHandoffResponse>('/auth/web-handoff', {
        method: 'POST',
        body: JSON.stringify({ next }),
    });
    if (!isWebHandoffUrl(response?.url)) {
        throw new Error('Invalid web handoff URL');
    }
    await Linking.openURL(response.url);
}

/** A public page of the website, e.g. `/privacy`. */
export function webPageUrl(path: '/privacy' | '/terms' | '/data-deletion'): string {
    return `${getMobileApiUrl()}${path}`;
}

/** The web profile section where a signed-in user deletes their account. */
export const ACCOUNT_DELETION_WEB_PATH = '/cabinet/profile#account-deletion';
