import { z } from 'zod';

import type { DbClient } from '@/lib/supabaseTypes';

/**
 * Expo push tokens of signed-in mobile installs (public.push_tokens, 20261125170000). Every
 * read and write goes through the service role: the table is closed to client sessions.
 * A token is a delivery address for one device; it is never logged in full (maskPushToken).
 */

/** ExponentPushToken[...] (current) or ExpoPushToken[...] (older SDKs). */
export const EXPO_PUSH_TOKEN_PATTERN = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{10,180}\]$/;

export const pushTokenSchema = z.string().trim().regex(EXPO_PUSH_TOKEN_PATTERN, 'Invalid Expo push token');

export const registerPushTokenSchema = z.object({
    token: pushTokenSchema,
    platform: z.enum(['ios', 'android']),
    deviceName: z.string().trim().max(100).nullable().optional(),
});

export const unregisterPushTokenSchema = z.object({ token: pushTokenSchema });

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

/** A user keeps at most this many installs; registering another drops the least recently updated. */
export const MAX_PUSH_TOKENS_PER_USER = 10;

/** "ExponentPushToken[abcd…wxyz]": enough to tell tokens apart in a log, not enough to use one. */
export function maskPushToken(token: string): string {
    const inner = /\[(.*)\]$/.exec(token)?.[1] ?? token;
    return inner.length <= 8 ? 'ExpoPushToken[…]' : `ExpoPushToken[${inner.slice(0, 4)}…${inner.slice(-4)}]`;
}

export class PushTokenStoreError extends Error {
    constructor(readonly operation: string) { super(`PUSH_TOKEN_${operation}_FAILED`); this.name = 'PushTokenStoreError'; }
}

/**
 * Registers `token` for `userId`. A token already registered to another account moves to this one:
 * the device signed in to a new account, and the previous account must not keep notifying it.
 */
export async function registerPushToken(admin: DbClient, userId: string, input: RegisterPushTokenInput): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await admin.from('push_tokens').upsert({
        user_id: userId,
        token: input.token,
        platform: input.platform,
        device_name: input.deviceName?.trim() || null,
        updated_at: now,
        last_error: null,
    }, { onConflict: 'token' });
    if (error) throw new PushTokenStoreError('REGISTER');

    const { data, error: listError } = await admin.from('push_tokens')
        .select('id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    if (listError) throw new PushTokenStoreError('REGISTER');
    const extra = (data ?? []).slice(MAX_PUSH_TOKENS_PER_USER).map(row => row.id);
    if (extra.length > 0) {
        const { error: pruneError } = await admin.from('push_tokens').delete().in('id', extra);
        if (pruneError) throw new PushTokenStoreError('REGISTER');
    }
}

/** Removes `token` if it belongs to `userId`; a token of another account or an unknown one is left alone. */
export async function unregisterPushToken(admin: DbClient, userId: string, token: string): Promise<void> {
    const { error } = await admin.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
    if (error) throw new PushTokenStoreError('UNREGISTER');
}

/**
 * The tokens of these users, for the booking notification planner. A read failure throws.
 * A user with a pending account deletion gets no push during the grace period, the same rule as
 * e-mail, Telegram and WhatsApp (requestAccountDeletion switches those profile flags off). The
 * tokens are kept, so cancelling the deletion brings push back without re-registering the device.
 */
export async function listPushTokens(admin: DbClient, userIds: string[]): Promise<Array<{ user_id: string; token: string }>> {
    const requested = [...new Set(userIds.filter(Boolean))];
    if (requested.length === 0) return [];
    const { data: pending, error: pendingError } = await admin.from('account_deletion_requests')
        .select('user_id')
        .in('user_id', requested)
        .eq('status', 'pending');
    if (pendingError) throw new PushTokenStoreError('LIST');
    const pendingIds = new Set((pending ?? []).map(row => row.user_id));
    const ids = requested.filter(id => !pendingIds.has(id));
    if (ids.length === 0) return [];
    const { data, error } = await admin.from('push_tokens')
        .select('user_id, token')
        .in('user_id', ids)
        .order('updated_at', { ascending: false });
    if (error) throw new PushTokenStoreError('LIST');
    return data ?? [];
}

/** Expo said the device is no longer registered (the app was uninstalled or the token rotated). */
export async function removeInvalidPushToken(admin: DbClient, token: string): Promise<void> {
    const { error } = await admin.from('push_tokens').delete().eq('token', token);
    if (error) throw new PushTokenStoreError('REMOVE');
}
