export type SocialProvider = 'google' | 'yandex' | 'telegram' | 'whatsapp';

type AuthUser = {
    id: string;
    identities?: Array<{ provider?: string | null }> | null;
    user_metadata?: Record<string, unknown> | null;
};

type AdminLike = {
    auth: {
        admin: {
            getUserById: (id: string) => Promise<{ data: { user: AuthUser | null }; error: { message?: string } | null }>;
            updateUserById: (id: string, payload: { user_metadata: Record<string, unknown> }) => Promise<{ error: { message?: string } | null }>;
        };
    };
    // Query builders differ for select and update operations in this narrow service boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

type ProfileConnections = {
    yandex_id: string | null;
    telegram_id: number | null;
    telegram_verified: boolean | null;
    whatsapp_phone: string | null;
    whatsapp_verified: boolean | null;
};

export type UnlinkResult =
    | { ok: true; data: { provider: SocialProvider; remainingMethods: number } }
    | { ok: false; error: 'validation' | 'not_found' | 'conflict' | 'internal'; message: string; status: number; details?: { code: string } };

const connectionLabels: Record<SocialProvider, string> = {
    google: 'Google',
    yandex: 'Яндекс',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
};

function cleanMetadata(metadata: Record<string, unknown> | null | undefined, provider: SocialProvider) {
    const next = { ...(metadata ?? {}) };
    if (provider === 'yandex') {
        delete next.yandex_id;
        delete next.yandex_username;
        if (next.auth_provider === 'yandex') delete next.auth_provider;
    } else if (provider === 'telegram') {
        delete next.telegram_id;
        delete next.telegram_username;
    } else if (provider === 'whatsapp') {
        delete next.whatsapp_verified;
        delete next.whatsapp_otp_code;
        delete next.whatsapp_otp_expires;
        delete next.whatsapp_otp_phone;
    }
    return next;
}

export async function unlinkSocialIdentity(params: {
    admin: AdminLike;
    userId: string;
    provider: SocialProvider;
}): Promise<UnlinkResult> {
    const { data: authData, error: authError } = await params.admin.auth.admin.getUserById(params.userId);
    if (authError || !authData.user) {
        return { ok: false, error: 'internal', message: 'Не удалось проверить способы входа.', status: 500, details: { code: 'auth_user_lookup_failed' } };
    }

    const { data: profile, error: profileError } = await params.admin
        .from('profiles')
        .select('yandex_id, telegram_id, telegram_verified, whatsapp_phone, whatsapp_verified')
        .eq('id', params.userId)
        .maybeSingle() as { data: ProfileConnections | null; error: { message?: string } | null };

    if (profileError) {
        return { ok: false, error: 'internal', message: 'Не удалось проверить профиль.', status: 500, details: { code: 'profile_lookup_failed' } };
    }

    const connected: Record<SocialProvider, boolean> = {
        google: !!authData.user.identities?.some((identity) => identity.provider === 'google'),
        yandex: !!profile?.yandex_id,
        telegram: !!profile?.telegram_id && !!profile.telegram_verified,
        whatsapp: !!profile?.whatsapp_phone && !!profile.whatsapp_verified,
    };
    const connectedCount = Object.values(connected).filter(Boolean).length;

    if (!connected[params.provider]) {
        return { ok: false, error: 'not_found', message: `${connectionLabels[params.provider]} уже не подключён.`, status: 404, details: { code: 'identity_not_connected' } };
    }
    if (connectedCount <= 1) {
        return { ok: false, error: 'conflict', message: 'Нельзя отвязать последний способ входа. Сначала подключите другой.', status: 409, details: { code: 'last_login_method' } };
    }

    if (params.provider === 'google') {
        const { data, error } = await params.admin.rpc('unlink_auth_identity', {
            target_user_id: params.userId,
            target_provider: 'google',
        });
        if (error || Number(data) !== 1) {
            return { ok: false, error: 'internal', message: 'Не удалось отвязать Google.', status: 500, details: { code: 'google_unlink_failed' } };
        }
    } else {
        const update = params.provider === 'yandex'
            ? { yandex_id: null }
            : params.provider === 'telegram'
                ? { telegram_id: null, telegram_verified: false, notify_telegram: false }
                : { whatsapp_phone: null, whatsapp_verified: false, notify_whatsapp: false };
        const { error } = await params.admin.from('profiles').update(update).eq('id', params.userId);
        if (error) {
            return { ok: false, error: 'internal', message: `Не удалось отвязать ${connectionLabels[params.provider]}.`, status: 500, details: { code: 'profile_unlink_failed' } };
        }

        const { error: metadataError } = await params.admin.auth.admin.updateUserById(params.userId, {
            user_metadata: cleanMetadata(authData.user.user_metadata, params.provider),
        });
        if (metadataError) {
            return { ok: false, error: 'internal', message: 'Связь удалена из профиля, но не удалось очистить данные входа. Обратитесь в поддержку.', status: 500, details: { code: 'metadata_cleanup_failed' } };
        }
    }

    return { ok: true, data: { provider: params.provider, remainingMethods: connectedCount - 1 } };
}
