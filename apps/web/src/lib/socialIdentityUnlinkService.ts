import type { DbClient } from '@/lib/supabaseTypes';
import { removeNotificationEmailSource } from '@/lib/userNotificationEmailService';

export type SocialProvider = 'google' | 'yandex' | 'telegram' | 'whatsapp';

type AdminLike = Pick<DbClient, 'from' | 'rpc' | 'auth'>;

export type UnlinkResult =
    | { ok: true; data: { provider: SocialProvider; remainingMethods: number } }
    | { ok: false; error: 'validation' | 'not_found' | 'conflict' | 'internal'; message: string; status: number; details?: { code: string } };

// One whole message per provider (FE-10): the API translates each of them, and no Russian provider
// name is inserted into a sentence.
const notConnectedMessages: Record<SocialProvider, string> = {
    google: 'Google уже не подключён.',
    yandex: 'Яндекс уже не подключён.',
    telegram: 'Telegram уже не подключён.',
    whatsapp: 'WhatsApp уже не подключён.',
};
const unlinkFailedMessages: Record<SocialProvider, string> = {
    google: 'Не удалось отвязать Google.',
    yandex: 'Не удалось отвязать Яндекс.',
    telegram: 'Не удалось отвязать Telegram.',
    whatsapp: 'Не удалось отвязать WhatsApp.',
};

function phoneDigits(value: unknown): string {
    const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
    return /^\d{8,15}$/.test(digits) ? digits : '';
}

function cleanMetadata(metadata: Record<string, unknown> | null | undefined, provider: SocialProvider, releasedPhones: readonly string[] = []) {
    const next = { ...(metadata ?? {}) };
    if (provider === 'yandex') {
        next.yandex_id = null;
        next.yandex_username = null;
        next.yandex_email = null;
        if (next.auth_provider === 'yandex') next.auth_provider = null;
    } else if (provider === 'telegram') {
        next.telegram_id = null;
        next.telegram_username = null;
    } else if (provider === 'whatsapp') {
        next.whatsapp_verified = null;
        next.whatsapp_otp_code = null;
        next.whatsapp_otp_expires = null;
        next.whatsapp_otp_phone = null;
        // The write-back merges keys: without an explicit null it would restore the released copy.
        if (releasedPhones.includes(phoneDigits(next.phone))) next.phone = null;
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
        .maybeSingle();

    if (profileError) {
        return { ok: false, error: 'internal', message: 'Не удалось проверить профиль.', status: 500, details: { code: 'profile_lookup_failed' } };
    }

    const metadata = authData.user.user_metadata ?? {};
    const connected: Record<SocialProvider, boolean> = {
        google: !!authData.user.identities?.some((identity) => identity.provider === 'google'),
        yandex: !!profile?.yandex_id || !!metadata.yandex_id || metadata.auth_provider === 'yandex',
        telegram: (!!profile?.telegram_id && !!profile.telegram_verified) || !!metadata.telegram_id,
        whatsapp: !!profile?.whatsapp_phone && !!profile.whatsapp_verified,
    };
    const connectedCount = Object.values(connected).filter(Boolean).length;

    if (!connected[params.provider]) {
        return { ok: false, error: 'not_found', message: notConnectedMessages[params.provider], status: 404, details: { code: 'identity_not_connected' } };
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
            return { ok: false, error: 'internal', message: unlinkFailedMessages.google, status: 500, details: { code: 'google_unlink_failed' } };
        }
        await removeNotificationEmailSource(params.admin, params.userId, 'google');
    } else {
        // WhatsApp sign-up made the number a confirmed Auth phone, which still counts as ownership
        // of the number (API-10). Release it first: if this fails the link is intact and the
        // request can be repeated; the release is idempotent.
        const releasedPhones = params.provider === 'whatsapp'
            ? [...new Set([phoneDigits(profile?.whatsapp_phone), authData.user.phone_confirmed_at ? phoneDigits(authData.user.phone) : ''].filter(Boolean))]
            : [];
        for (const digits of releasedPhones) {
            const { error } = await params.admin.rpc('release_auth_phone', { p_user_id: params.userId, p_phone_digits: digits });
            if (error) {
                return { ok: false, error: 'internal', message: unlinkFailedMessages.whatsapp, status: 500, details: { code: 'auth_phone_release_failed' } };
            }
        }

        const update = params.provider === 'yandex'
            ? { yandex_id: null }
            : params.provider === 'telegram'
                ? { telegram_id: null, telegram_verified: false, notify_telegram: false }
                : { whatsapp_phone: null, whatsapp_verified: false, notify_whatsapp: false };
        const { error } = await params.admin.from('profiles').update(update).eq('id', params.userId);
        if (error) {
            return { ok: false, error: 'internal', message: unlinkFailedMessages[params.provider], status: 500, details: { code: 'profile_unlink_failed' } };
        }

        const { error: metadataError } = await params.admin.auth.admin.updateUserById(params.userId, {
            user_metadata: cleanMetadata(authData.user.user_metadata, params.provider, releasedPhones),
        });
        if (metadataError) {
            return { ok: false, error: 'internal', message: 'Связь удалена из профиля, но не удалось очистить данные входа. Обратитесь в поддержку.', status: 500, details: { code: 'metadata_cleanup_failed' } };
        }
        if (params.provider === 'yandex') {
            await removeNotificationEmailSource(params.admin, params.userId, 'yandex');
        }
    }

    return { ok: true, data: { provider: params.provider, remainingMethods: connectedCount - 1 } };
}
