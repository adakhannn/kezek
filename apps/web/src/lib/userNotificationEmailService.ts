type AuthIdentity = {
    provider?: string | null;
    identity_data?: Record<string, unknown> | null;
    id?: string;
};

export type NotificationEmailUser = {
    id: string;
    email?: string | null;
    email_confirmed_at?: string | null;
    identities?: AuthIdentity[] | null;
    user_metadata?: Record<string, unknown> | null;
};

type AdminLike = {
    rpc: (
        name: string,
        params: Record<string, unknown>,
    ) => PromiseLike<{ error: { message?: string } | null }>;
};

function identityEmail(identity: AuthIdentity): string | null {
    const email = identity.identity_data?.email;
    return typeof email === 'string' && email.trim() ? email.trim() : null;
}

async function syncSource(
    admin: AdminLike,
    userId: string,
    email: string,
    source: 'account' | 'google' | 'yandex',
    providerSubject?: string | null,
) {
    const { error } = await admin.rpc('sync_user_notification_email', {
        target_user_id: userId,
        target_email: email,
        target_source: source,
        target_provider_subject: providerSubject ?? null,
    });
    if (error) throw new Error(error.message || `Failed to sync ${source} notification email`);
}

export async function syncNotificationEmailsFromUser(
    admin: AdminLike,
    user: NotificationEmailUser,
) {
    if (user.email && user.email_confirmed_at) {
        await syncSource(admin, user.id, user.email, 'account', user.id);
    }

    for (const identity of user.identities ?? []) {
        if (identity.provider !== 'google') continue;
        const email = identityEmail(identity);
        if (email) await syncSource(admin, user.id, email, 'google', identity.id ?? null);
    }

    const yandexEmail = user.user_metadata?.yandex_email;
    if (typeof yandexEmail === 'string' && yandexEmail.trim()) {
        await syncSource(
            admin,
            user.id,
            yandexEmail,
            'yandex',
            String(user.user_metadata?.yandex_id ?? ''),
        );
    }
}

export async function removeNotificationEmailSource(
    admin: AdminLike,
    userId: string,
    source: 'google' | 'yandex',
) {
    const { error } = await admin.rpc('remove_user_notification_email_source', {
        target_user_id: userId,
        target_source: source,
    });
    if (error) throw new Error(error.message || `Failed to remove ${source} notification email`);
}
