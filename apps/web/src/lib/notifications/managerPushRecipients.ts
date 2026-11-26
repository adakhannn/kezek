import { notificationLocale, type NotificationLocale } from './notificationText';

import { listBusinessManagerUserIds } from '@/lib/businessManagerAccess';
import type { DbTableClient } from '@/lib/supabaseTypes';

export type ManagerPushRecipient = { userId: string; locale: NotificationLocale };

/**
 * The owner and the owner/admin/manager accounts of a business, each with its preferred_locale,
 * as push recipients of a new or cancelled booking (O2). Reads are strict like the push tokens:
 * a failed read fails the preparation instead of silently dropping the managers.
 */
export async function listManagerPushRecipients(
    admin: DbTableClient,
    bizId: string | null | undefined,
    ownerId: string | null | undefined,
): Promise<ManagerPushRecipient[]> {
    const userIds = bizId ? await listBusinessManagerUserIds(admin, bizId, ownerId) : ownerId ? [ownerId] : [];
    if (userIds.length === 0) return [];
    const { data, error } = await admin.from('profiles').select('id, preferred_locale').in('id', userIds);
    if (error) throw new Error('MANAGER_PUSH_PROFILES_FAILED');
    const localeById = new Map((data ?? []).map((row: { id: string; preferred_locale: string | null }) => [row.id, row.preferred_locale]));
    return userIds.map(userId => ({ userId, locale: notificationLocale(localeById.get(userId) ?? null) }));
}
