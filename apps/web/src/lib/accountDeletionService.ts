export type AccountDeletionBlocker = {
    code: 'super_admin' | 'owned_businesses' | 'business_roles' | 'active_staff' | 'active_bookings';
    message: string;
    count: number;
};

type AdminLike = {
    // Supabase query builders differ for count, select, and mutation calls.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
    auth: {
        admin: {
            getUserById: (id: string) => Promise<{ data: { user: { user_metadata?: Record<string, unknown> | null } | null }; error: { message?: string } | null }>;
            updateUserById: (id: string, payload: { user_metadata: Record<string, unknown> }) => Promise<{ error: { message?: string } | null }>;
        };
    };
};

export const ACCOUNT_DELETION_GRACE_DAYS = 7;
const ACCOUNT_DELETION_CONFIRMATION_PHRASES = new Set(['УДАЛИТЬ', 'DELETE', 'ӨЧҮРҮҮ']);

async function countQuery(query: PromiseLike<{ count: number | null; error: { message?: string } | null }>) {
    const { count, error } = await query;
    if (error) throw new Error(error.message || 'Account deletion assessment failed');
    return count ?? 0;
}

export async function assessAccountDeletion(admin: AdminLike, userId: string): Promise<AccountDeletionBlocker[]> {
    const now = new Date().toISOString();
    const [superAdmin, ownedBusinesses, businessRoles, globalRoles, staffRecords, activeBookings] = await Promise.all([
        countQuery(admin.from('user_roles_with_user').select('user_id', { count: 'exact', head: true }).eq('user_id', userId).eq('role_key', 'super_admin')),
        countQuery(admin.from('businesses').select('id', { count: 'exact', head: true }).eq('owner_id', userId)),
        countQuery(admin.from('user_roles').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
        countQuery(admin.from('user_global_roles').select('user_id', { count: 'exact', head: true }).eq('user_id', userId)),
        countQuery(admin.from('staff').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
        countQuery(admin.from('bookings').select('id', { count: 'exact', head: true }).eq('client_id', userId).in('status', ['hold', 'confirmed', 'paid']).gte('start_at', now)),
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
    if (error) throw new Error(error.message || 'Не удалось загрузить статус удаления аккаунта');
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
    if (preferencesError) throw new Error(preferencesError.message || 'Не удалось сохранить настройки уведомлений');
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
    if (error) throw new Error(error.message || 'Не удалось создать запрос на удаление');

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
    if (metadataError) throw new Error(metadataError.message || 'Не удалось пометить аккаунт на удаление');
    return { ok: true as const, scheduledFor: scheduledFor.toISOString() };
}

export async function cancelAccountDeletion(admin: AdminLike, userId: string) {
    const now = new Date().toISOString();
    const { data: request, error: requestError } = await admin
        .from('account_deletion_requests')
        .select('preference_snapshot')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
    if (requestError) throw new Error(requestError.message || 'Не удалось загрузить запрос на удаление');
    const { error } = await admin.from('account_deletion_requests').update({ status: 'cancelled', cancelled_at: now, updated_at: now }).eq('user_id', userId).eq('status', 'pending');
    if (error) throw new Error(error.message || 'Не удалось отменить удаление');
    const preferences = request?.preference_snapshot;
    if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
        const allowed = ['notify_email', 'notify_sms', 'notify_telegram', 'notify_whatsapp'];
        const restored = Object.fromEntries(Object.entries(preferences).filter(([key, value]) => allowed.includes(key) && typeof value === 'boolean'));
        if (Object.keys(restored).length) await admin.from('profiles').update(restored).eq('id', userId);
    }
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
            ...(authData.user?.user_metadata ?? {}),
            account_deletion_pending: null,
            account_deletion_scheduled_for: null,
        },
    });
    if (metadataError) throw new Error(metadataError.message || 'Не удалось восстановить аккаунт');
    return { ok: true as const };
}
