import * as WebBrowser from 'expo-web-browser';

import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { handleDeepLinkAuth } from '../../navigation/useRootNavigationSession';
import {
    parseNotificationEmails,
    type NotificationEmail,
    type SocialProvider,
    type TelegramLinkAttempt,
    type TelegramLinkState,
} from './profileConnections';

/** The same endpoints as the website's profile; the app's Bearer token identifies the user. */

export async function fetchNotificationEmails(): Promise<NotificationEmail[]> {
    const response = await apiRequest<{ ok?: boolean; data?: unknown }>('/profile/notification-emails');
    if (!response?.ok) throw new Error('Notification emails were not loaded');
    return parseNotificationEmails(response.data);
}

export async function unlinkLoginMethod(provider: SocialProvider): Promise<void> {
    const response = await apiRequest<{ ok?: boolean; message?: string }>('/auth/connections/unlink', {
        method: 'POST',
        body: JSON.stringify({ provider }),
    });
    if (!response?.ok) throw new Error(response?.message || 'Unlink failed');
}

type ProfileLinkBody =
    | { action: 'create' }
    | { action: 'status' | 'cancel'; token: string }
    | { action: 'finish'; token: string; telegramId: number };

async function profileLink<T>(body: ProfileLinkBody, signal?: AbortSignal): Promise<T> {
    const response = await apiRequest<{ ok?: boolean; data?: T; message?: string }>('/auth/telegram/profile-link', {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
    });
    if (!response?.ok) throw new Error(response?.message || 'Telegram link request failed');
    return response.data as T;
}

/** Telegram linking through the bot (web TelegramBotLink): create, poll the status, then finish. */
export const telegramProfileLink = {
    create: () => profileLink<TelegramLinkAttempt>({ action: 'create' }),
    status: (token: string, signal?: AbortSignal) => profileLink<TelegramLinkState>({ action: 'status', token }, signal),
    cancel: (token: string) => profileLink<unknown>({ action: 'cancel', token }),
    finish: (token: string, telegramId: number) => profileLink<unknown>({ action: 'finish', token, telegramId }),
};

export type AccountDeletionBlocker = { code: string; message: string; count: number };

export type AccountDeletionState = {
    request: { status: string; requested_at: string; scheduled_for: string } | null;
    blockers: AccountDeletionBlocker[];
    eligible: boolean;
};

export async function fetchAccountDeletionState(): Promise<AccountDeletionState> {
    const response = await apiRequest<{ ok?: boolean; data?: AccountDeletionState }>('/account/deletion');
    if (!response?.ok || !response.data) throw new Error('Account deletion state was not loaded');
    return { ...response.data, blockers: response.data.blockers ?? [] };
}

export async function requestAccountDeletion(confirmation: string): Promise<void> {
    const response = await apiRequest<{ ok?: boolean; message?: string }>('/account/deletion', {
        method: 'POST',
        body: JSON.stringify({ confirmation }),
    });
    if (!response?.ok) throw new Error(response?.message || 'Account deletion was not requested');
}

export async function cancelAccountDeletion(): Promise<void> {
    const response = await apiRequest<{ ok?: boolean; message?: string }>('/account/deletion', { method: 'DELETE' });
    if (!response?.ok) throw new Error(response?.message || 'Account deletion was not cancelled');
}

/** The app's OAuth return address, the one Google sign-in already uses. */
export const GOOGLE_LINK_REDIRECT = 'kezek://auth/callback';

/**
 * Links Google to the signed-in account (web supabase.auth.linkIdentity): the consent page opens in
 * an auth session, the returned PKCE code is exchanged like a sign-in callback, and the result is
 * read back from Auth. 'cancelled' when the user closed the page.
 */
export async function linkGoogleIdentity(): Promise<'linked' | 'cancelled'> {
    const { data, error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
            redirectTo: GOOGLE_LINK_REDIRECT,
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account' },
        },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Google link URL is missing');

    const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_LINK_REDIRECT);
    if (result.type !== 'success') return 'cancelled';

    const returned = new URL(result.url);
    const params = new URLSearchParams(returned.hash.replace(/^#/, ''));
    const oauthError = returned.searchParams.get('error_description') ?? params.get('error_description');
    if (oauthError) throw new Error(oauthError);

    await handleDeepLinkAuth(result.url);
    // The root deep-link listener may have exchanged the same code first: Auth decides.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const linked = (userData.user?.identities ?? []).some((identity) => identity.provider === 'google')
        || (userData.user?.app_metadata?.providers ?? []).includes('google');
    if (!linked) throw new Error('Google was not linked');
    return 'linked';
}
