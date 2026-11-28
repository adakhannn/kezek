import { ACTIVE_BOOKING_STATUSES } from '@core-domain/booking';

import { databaseFailure } from '@/lib/apiErrorHandler';
import type { DbClient, DbUpdate } from '@/lib/supabaseTypes';

export type AccountDeletionBlocker = {
    code: 'super_admin' | 'owned_businesses' | 'business_roles' | 'active_staff' | 'active_bookings';
    message: string;
    count: number;
};

type AdminLike = Pick<DbClient, 'from' | 'rpc' | 'auth'>;

export const ACCOUNT_DELETION_GRACE_DAYS = 7;
const ACCOUNT_DELETION_CONFIRMATION_PHRASES = new Set(['УДАЛИТЬ', 'DELETE', 'ӨЧҮРҮҮ']);

// Every store of the platform role (DB-10), not only user_roles: 1 when the account is a super admin.
async function superAdminCount(admin: AdminLike, userId: string) {
    const { data, error } = await admin.rpc('super_admin_user_ids');
    if (error) throw databaseFailure(error, 'Account deletion assessment failed');
    return (data ?? []).includes(userId) ? 1 : 0;
}

async function countQuery(query: PromiseLike<{ count: number | null; error: { message?: string } | null }>) {
    const { count, error } = await query;
    if (error) throw databaseFailure(error, 'Account deletion assessment failed');
    return count ?? 0;
}

export async function assessAccountDeletion(admin: AdminLike, userId: string): Promise<AccountDeletionBlocker[]> {
    const now = new Date().toISOString();
    const [superAdmin, ownedBusinesses, businessRoles, globalRoles, staffRecords, activeBookings] = await Promise.all([
        superAdminCount(admin, userId),
        countQuery(admin.from('businesses').select('id', { count: 'exact', head: true }).eq('owner_id', userId)),
        countQuery(admin.from('user_roles').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
        countQuery(admin.from('user_global_roles').select('user_id', { count: 'exact', head: true }).eq('user_id', userId)),
        countQuery(admin.from('staff').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
        countQuery(admin.from('bookings').select('id', { count: 'exact', head: true }).eq('client_id', userId).in('status', [...ACTIVE_BOOKING_STATUSES]).gte('start_at', now)),
    ]);

    const blockers: AccountDeletionBlocker[] = [];
    if (superAdmin) blockers.push({ code: 'super_admin', count: superAdmin, message: 'Сначала передайте права super-admin другому администратору.' });
    if (ownedBusinesses) blockers.push({ code: 'owned_businesses', count: ownedBusinesses, message: 'Сначала передайте владение или закройте все принадлежащие вам бизнесы.' });
    if (businessRoles + globalRoles) blockers.push({ code: 'business_roles', count: businessRoles + globalRoles, message: 'Сначала попросите администратора удалить ваши роли в системе и бизнесах.' });
    if (staffRecords) blockers.push({ code: 'active_staff', count: staffRecords, message: 'Сначала попросите владельца удалить или обезличить ваши карточки сотрудника.' });
    if (activeBookings) blockers.push({ code: 'active_bookings', count: activeBookings, message: 'Сначала отмените или завершите будущие активные записи.' });
    return blockers;
}

export async function getAccountDeletionState(admin: AdminLike, userId: string) {
    const [{ data: request, error }, blockers] = await Promise.all([
        admin.from('account_deletion_requests').select('status, requested_at, scheduled_for').eq('user_id', userId).maybeSingle(),
        assessAccountDeletion(admin, userId),
    ]);
    if (error) throw databaseFailure(error, 'Не удалось загрузить статус удаления аккаунта');
    return { request, blockers, eligible: blockers.length === 0 };
}

export async function requestAccountDeletion(admin: AdminLike, userId: string, confirmation: string) {
    if (!ACCOUNT_DELETION_CONFIRMATION_PHRASES.has(confirmation.trim().toUpperCase())) {
        return { ok: false as const, status: 400, message: 'Введите УДАЛИТЬ для подтверждения.', code: 'confirmation_required' };
    }
    const blockers = await assessAccountDeletion(admin, userId);
    if (blockers.length) {
        return { ok: false as const, status: 409, message: 'Удаление пока недоступно. Устраните указанные условия.', code: 'deletion_blocked', blockers };
    }

    const requestedAt = new Date();
    const scheduledFor = new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const { data: preferences, error: preferencesError } = await admin
        .from('profiles')
        .select('notify_email, notify_sms, notify_telegram, notify_whatsapp')
        .eq('id', userId)
        .maybeSingle();
    if (preferencesError) throw databaseFailure(preferencesError, 'Не удалось сохранить настройки уведомлений');
    const { error } = await admin.from('account_deletion_requests').upsert({
        user_id: userId,
        status: 'pending',
        requested_at: requestedAt.toISOString(),
        scheduled_for: scheduledFor.toISOString(),
        cancelled_at: null,
        completed_at: null,
        blocker_snapshot: [],
        preference_snapshot: preferences ?? {},
        updated_at: requestedAt.toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw databaseFailure(error, 'Не удалось создать запрос на удаление');

    await admin.from('profiles').update({
        notify_email: false,
        notify_sms: false,
        notify_telegram: false,
        notify_whatsapp: false,
    }).eq('id', userId);

    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
            ...(authData.user?.user_metadata ?? {}),
            account_deletion_pending: true,
            account_deletion_scheduled_for: scheduledFor.toISOString(),
        },
    });
    if (metadataError) throw databaseFailure(metadataError, 'Не удалось пометить аккаунт на удаление');
    return { ok: true as const, scheduledFor: scheduledFor.toISOString() };
}

const NOTIFICATION_PREFERENCE_KEYS = ['notify_email', 'notify_sms', 'notify_telegram', 'notify_whatsapp'] as const;

/** Puts back the channel switches saved when the deletion was requested (preference_snapshot). */
async function restoreNotificationPreferences(admin: AdminLike, userId: string, snapshot: unknown) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return;
    const saved = snapshot as Record<string, unknown>;
    const restored: DbUpdate<'profiles'> = {};
    for (const key of NOTIFICATION_PREFERENCE_KEYS) {
        const value = saved[key];
        if (typeof value === 'boolean') restored[key] = value;
    }
    if (!Object.keys(restored).length) return;
    const { error } = await admin.from('profiles').update(restored).eq('id', userId);
    if (error) throw databaseFailure(error, 'Не удалось сохранить настройки уведомлений');
}

/** The account is no longer scheduled for deletion: drop the marks requestAccountDeletion set. */
async function clearDeletionMetadata(admin: AdminLike, userId: string) {
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
            ...(authData.user?.user_metadata ?? {}),
            account_deletion_pending: null,
            account_deletion_scheduled_for: null,
        },
    });
    if (metadataError) throw databaseFailure(metadataError, 'Не удалось восстановить аккаунт');
}

export async function cancelAccountDeletion(admin: AdminLike, userId: string) {
    const now = new Date().toISOString();
    const { data: request, error: requestError } = await admin
        .from('account_deletion_requests')
        .select('preference_snapshot')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
    if (requestError) throw databaseFailure(requestError, 'Не удалось загрузить запрос на удаление');
    const { error } = await admin.from('account_deletion_requests').update({ status: 'cancelled', cancelled_at: now, updated_at: now }).eq('user_id', userId).eq('status', 'pending');
    if (error) throw databaseFailure(error, 'Не удалось отменить удаление');
    await restoreNotificationPreferences(admin, userId, request?.preference_snapshot);
    await clearDeletionMetadata(admin, userId);
    return { ok: true as const };
}

/**
 * A request that met a blocker on its due date (finalize_due_account_deletions sets `blocked`) is
 * closed for good and never retried by itself: the blocker usually comes from the user's own use of
 * the account during the grace period (a new booking, a staff card, a business role), and deleting
 * such an account weeks later without a fresh confirmation would be irreversible and unexpected.
 * The user requests again once the reasons are gone; the profile says so.
 *
 * What the database function leaves behind is a dead end: the notification switches stay off and the
 * account still carries the "deletion pending" marks. This step, run by the daily data-retention job
 * right after the finalize step, gives each newly blocked account its notifications back, clears the
 * marks, records the blockers seen now and closes the request (cancelled_at), so it is handled once.
 * Every write is repeatable: a failure part-way is finished by the next run.
 */
export async function releaseBlockedAccountDeletions(admin: AdminLike, batchLimit = 50): Promise<number> {
    const { data, error } = await admin
        .from('account_deletion_requests')
        .select('user_id, preference_snapshot')
        .eq('status', 'blocked')
        .is('cancelled_at', null)
        .order('updated_at', { ascending: true })
        .limit(batchLimit);
    if (error) throw databaseFailure(error, 'Blocked account deletions could not be loaded');
    let released = 0;
    for (const row of data ?? []) {
        const blockers = await assessAccountDeletion(admin, row.user_id);
        await restoreNotificationPreferences(admin, row.user_id, row.preference_snapshot);
        await clearDeletionMetadata(admin, row.user_id);
        const now = new Date().toISOString();
        const { data: closed, error: closeError } = await admin
            .from('account_deletion_requests')
            .update({
                cancelled_at: now,
                updated_at: now,
                blocker_snapshot: blockers.map(({ code, count }) => ({ code, count })),
            })
            .eq('user_id', row.user_id)
            .eq('status', 'blocked')
            .is('cancelled_at', null)
            .select('user_id');
        if (closeError) throw databaseFailure(closeError, 'Blocked account deletion could not be closed');
        if (closed?.length) released += 1;
    }
    return released;
}
