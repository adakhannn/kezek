import crypto from 'crypto';

import { logDebug, logError } from '@/lib/log';
import { buildSessionCallbackUrl } from '@/lib/sessionCallbackUrl';
import type { DbClient } from '@/lib/supabaseTypes';
import { issueSessionForVerifiedUser } from '@/lib/verifiedIdentitySession';

export type YandexUserInfo = {
    id: string | number;
    login?: string | null;
    default_email?: string | null;
    real_name?: string | null;
    display_name?: string | null;
    first_name?: string | null;
};

export type YandexAuthAdminClient = Pick<DbClient, 'from' | 'auth' | 'rpc'>;

type RunYandexOAuthCallbackInput = {
    admin: YandexAuthAdminClient;
    yandexUser: YandexUserInfo;
    origin: string;
    redirectTo: string;
    randomHex?: (size: number) => string;
    linkUserId?: string;
};

function defaultRandomHex(size: number) {
    return crypto.randomBytes(size).toString('hex');
}

function providerName(yandexUser: YandexUserInfo) {
    return yandexUser.real_name || yandexUser.display_name || yandexUser.first_name || null;
}

function yandexIdentityPayload(yandexUser: YandexUserInfo) {
    return {
        yandex_id: String(yandexUser.id),
        yandex_username: yandexUser.login || null,
    };
}

function newProfilePayload(yandexUser: YandexUserInfo) {
    return {
        full_name: providerName(yandexUser),
        ...yandexIdentityPayload(yandexUser),
    };
}

function redirectWithError(origin: string, message: string) {
    return `${origin}/auth/sign-in?error=${encodeURIComponent(message)}`;
}

async function findExistingProfile(admin: YandexAuthAdminClient, yandexUser: YandexUserInfo) {
    const { data, error } = await admin
        .from('profiles')
        .select('id, yandex_id, full_name')
        .eq('yandex_id', String(yandexUser.id))
        .maybeSingle();
    if (error) {
        logError('YandexAuth', 'Profile select error', error);
    }
    return data;
}

async function updateExistingProfile(
    admin: YandexAuthAdminClient,
    profile: { id: string; full_name: string | null },
    yandexUser: YandexUserInfo,
) {
    const name = providerName(yandexUser);
    const { error } = await admin
        .from('profiles')
        .update({
            ...yandexIdentityPayload(yandexUser),
            ...(!profile.full_name?.trim() && name ? { full_name: name } : {}),
        })
        .eq('id', profile.id);

    if (error) {
        logError('YandexAuth', 'Profile update error', error);
    }
}

async function ensureProfile(admin: YandexAuthAdminClient, userId: string, yandexUser: YandexUserInfo) {
    const { data: existingProfile } = await admin
        .from('profiles')
        .select('id, full_name')
        .eq('id', userId)
        .maybeSingle();

    if (!existingProfile) {
        const { error } = await admin.from('profiles').insert({
            id: userId,
            ...newProfilePayload(yandexUser),
        });

        if (error) {
            logError('YandexAuth', 'Profile insert error', error);
        }
        return;
    }

    await updateExistingProfile(admin, existingProfile, yandexUser);
}

async function syncYandexNotificationEmail(
    admin: YandexAuthAdminClient,
    userId: string,
    yandexUser: YandexUserInfo,
) {
    if (!yandexUser.default_email) return;
    const { error } = await admin.rpc('sync_user_notification_email', {
        target_user_id: userId,
        target_email: yandexUser.default_email,
        target_source: 'yandex',
        target_provider_subject: String(yandexUser.id),
    });
    if (error) {
        logError('YandexAuth', 'Notification email sync failed', error);
    }
}

async function resolveUserViaEmailDuplicate(
    admin: YandexAuthAdminClient,
    origin: string,
    email: string,
    yandexUser: YandexUserInfo
) {
    try {
        // Join the existing account only when it has confirmed this address (ARCH-03). An account
        // that merely registered the address without confirming it was never proven to belong to
        // the owner of the Yandex mailbox: joining it would hand that mailbox owner's sign-in to
        // whoever pre-registered the address (and knows its password). The lookup is exact and
        // case-insensitive, without paging through Auth users.
        const { data, error } = await admin.rpc('find_accounts_by_contact', { p_email: email });
        if (error) throw error;
        const accounts = Array.isArray(data) ? (data as Array<{ id?: string }>) : [];

        if (accounts.length === 1 && accounts[0].id) {
            await ensureProfile(admin, accounts[0].id, yandexUser);
            return { ok: true as const, userId: accounts[0].id };
        }
    } catch (error) {
        logError('YandexAuth', 'Error finding user by email', error);
    }

    return {
        ok: false as const,
        redirectUrl: redirectWithError(
            origin,
            'Пользователь с таким email уже существует. Попробуйте войти через email.'
        ),
    };
}

async function createOrFindUser(
    admin: YandexAuthAdminClient,
    origin: string,
    yandexUser: YandexUserInfo,
    randomHex: (size: number) => string
) {
    const email = yandexUser.default_email || `yandex_${yandexUser.id}@yandex.local`;
    const initialPassword = randomHex(32);

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
            yandex_id: String(yandexUser.id),
            yandex_username: yandexUser.login,
            yandex_email: yandexUser.default_email ?? null,
            auth_provider: 'yandex',
        },
    });

    if (authError) {
        if (
            authError.message?.includes('already registered') ||
            authError.message?.includes('already exists') ||
            authError.message?.includes('email address has already been registered')
        ) {
            logDebug('YandexAuth', 'User already exists, trying to find by email', { email });
            return resolveUserViaEmailDuplicate(admin, origin, email, yandexUser);
        }

        logError('YandexAuth', 'Create user error', authError);
        return {
            ok: false as const,
            redirectUrl: redirectWithError(origin, `Ошибка создания пользователя: ${authError.message || 'Failed to create user'}`),
        };
    }

    if (!authData?.user) {
        logError('YandexAuth', 'Create user returned no user data');
        return {
            ok: false as const,
            redirectUrl: redirectWithError(origin, 'Ошибка создания пользователя: нет данных пользователя'),
        };
    }

    await ensureProfile(admin, authData.user.id, yandexUser);
    return {
        ok: true as const,
        userId: authData.user.id,
    };
}

export async function runYandexOAuthCallback({
    admin,
    yandexUser,
    origin,
    redirectTo,
    randomHex = defaultRandomHex,
    linkUserId,
}: RunYandexOAuthCallbackInput): Promise<{ redirectUrl: string }> {
    const existingProfile = await findExistingProfile(admin, yandexUser);
    let userId: string;

    if (linkUserId) {
        if (existingProfile?.id && existingProfile.id !== linkUserId) {
            return {
                redirectUrl: `${origin}/cabinet/profile?error=yandex_identity_already_linked`,
            };
        }

        await ensureProfile(admin, linkUserId, yandexUser);
        const { data: linkedUser, error: linkedUserError } = await admin.auth.admin.getUserById(linkUserId);
        if (linkedUserError || !linkedUser?.user) {
            return {
                redirectUrl: `${origin}/cabinet/profile?error=yandex_link_failed`,
            };
        }
        await admin.auth.admin.updateUserById(linkUserId, {
            user_metadata: {
                ...(linkedUser.user.user_metadata ?? {}),
                yandex_id: String(yandexUser.id),
                yandex_username: yandexUser.login ?? null,
                yandex_email: yandexUser.default_email ?? null,
            },
        });
        await syncYandexNotificationEmail(admin, linkUserId, yandexUser);
        return { redirectUrl: `${origin}/cabinet/profile?linked=yandex` };
    }

    if (existingProfile?.id) {
        userId = existingProfile.id;
        await updateExistingProfile(admin, existingProfile, yandexUser);
    } else {
        const userResolution = await createOrFindUser(admin, origin, yandexUser, randomHex);
        if (!userResolution.ok) {
            return { redirectUrl: userResolution.redirectUrl };
        }
        userId = userResolution.userId;
    }

    await syncYandexNotificationEmail(admin, userId, yandexUser);
    const session = await issueSessionForVerifiedUser(userId);

    const redirectUrl = buildSessionCallbackUrl({
        origin,
        next: redirectTo,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
    });

    logDebug('YandexAuth', 'Redirecting to callback with tokens', { userId });
    return { redirectUrl };
}
