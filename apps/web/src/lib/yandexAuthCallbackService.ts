import crypto from 'crypto';

import { logDebug, logError } from '@/lib/log';

export type YandexUserInfo = {
    id: string | number;
    login?: string | null;
    default_email?: string | null;
    real_name?: string | null;
    display_name?: string | null;
    first_name?: string | null;
};

type AuthUserLike = {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
};

export type YandexAuthAdminClientLike = {
    // Supabase query builders vary by operation in this service boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
    auth: {
        admin: {
            createUser: (payload: unknown) => Promise<{ data?: { user?: AuthUserLike }; error?: { message?: string } | null }>;
            listUsers: () => Promise<{ data: { users: AuthUserLike[] } }>;
            getUserById: (id: string) => Promise<{ data?: { user?: AuthUserLike }; error?: { message?: string } | null }>;
            updateUserById: (id: string, payload: unknown) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
        };
        signInWithPassword: (payload: { email: string; password: string }) => Promise<{
            data: { session?: { access_token: string; refresh_token: string } | null };
            error?: { message?: string } | null;
        }>;
    };
};

type RunYandexOAuthCallbackInput = {
    admin: YandexAuthAdminClientLike;
    yandexUser: YandexUserInfo;
    origin: string;
    redirectTo: string;
    randomHex?: (size: number) => string;
    linkUserId?: string;
};

function defaultRandomHex(size: number) {
    return crypto.randomBytes(size).toString('hex');
}

function profilePayload(yandexUser: YandexUserInfo) {
    return {
        full_name: yandexUser.real_name || yandexUser.display_name || yandexUser.first_name || null,
        yandex_id: String(yandexUser.id),
        yandex_username: yandexUser.login || null,
    };
}

function redirectWithError(origin: string, message: string) {
    return `${origin}/auth/sign-in?error=${encodeURIComponent(message)}`;
}

async function findExistingProfile(admin: YandexAuthAdminClientLike, yandexUser: YandexUserInfo) {
    const response = (admin
        .from('profiles')
        .select('id, yandex_id')
        .eq('yandex_id', String(yandexUser.id))
        .maybeSingle() as Promise<{ data: { id: string | null; yandex_id: string | null } | null; error: { message?: string } | null }>);

    const { data, error } = await response;
    if (error) {
        logError('YandexAuth', 'Profile select error', error);
    }
    return data;
}

async function updateExistingProfile(admin: YandexAuthAdminClientLike, userId: string, yandexUser: YandexUserInfo) {
    const { error } = await admin
        .from('profiles')
        .update({
            ...profilePayload(yandexUser),
            updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

    if (error) {
        logError('YandexAuth', 'Profile update error', error);
    }
}

async function ensureProfile(admin: YandexAuthAdminClientLike, userId: string, yandexUser: YandexUserInfo) {
    const existingProfileResponse = (admin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle() as Promise<{ data: { id: string } | null }>);
    const { data: existingProfile } = await existingProfileResponse;

    if (!existingProfile) {
        const { error } = await admin.from('profiles').insert({
            id: userId,
            ...profilePayload(yandexUser),
        });

        if (error) {
            logError('YandexAuth', 'Profile insert error', error);
        }
        return;
    }

    await admin
        .from('profiles')
        .update({
            ...profilePayload(yandexUser),
            updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
}

async function resolveUserViaEmailDuplicate(
    admin: YandexAuthAdminClientLike,
    origin: string,
    email: string,
    yandexUser: YandexUserInfo
) {
    try {
        const authUsersViewResponse = (admin
            .from('auth_users_view')
            .select('id')
            .eq('email', email)
            .maybeSingle() as Promise<{ data: { id: string } | null }>);
        const { data: userByEmail } = await authUsersViewResponse;

        if (userByEmail?.id) {
            await ensureProfile(admin, userByEmail.id, yandexUser);
            return { ok: true as const, userId: userByEmail.id };
        }

        const {
            data: { users },
        } = await admin.auth.admin.listUsers();
        const existingUser = users?.find((user) => user.email === email);

        if (existingUser) {
            await ensureProfile(admin, existingUser.id, yandexUser);
            return { ok: true as const, userId: existingUser.id };
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
    admin: YandexAuthAdminClientLike,
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

function buildCallbackRedirect({
    origin,
    redirectTo,
    accessToken,
    refreshToken,
}: {
    origin: string;
    redirectTo: string;
    accessToken: string;
    refreshToken: string;
}) {
    const redirectUrl = new URL('/auth/callback', origin);
    redirectUrl.searchParams.set('next', redirectTo);
    redirectUrl.hash = `access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
    return redirectUrl.toString();
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
            },
        });
        return { redirectUrl: `${origin}/cabinet/profile?linked=yandex` };
    }

    if (existingProfile?.id) {
        userId = existingProfile.id;
        await updateExistingProfile(admin, userId, yandexUser);
    } else {
        const userResolution = await createOrFindUser(admin, origin, yandexUser, randomHex);
        if (!userResolution.ok) {
            return { redirectUrl: userResolution.redirectUrl };
        }
        userId = userResolution.userId;
    }

    const { data: currentUser, error: getUserError } = await admin.auth.admin.getUserById(userId);
    if (getUserError) {
        logError('YandexAuth', 'getUserById error', getUserError);
        throw new Error('Failed to get user info');
    }

    const userEmail = currentUser?.user?.email || yandexUser.default_email || `yandex_${yandexUser.id}@yandex.local`;

    if (!currentUser?.user?.email && yandexUser.default_email) {
        await admin.auth.admin.updateUserById(userId, {
            email: yandexUser.default_email,
            email_confirm: true,
        });
    }

    const tempPassword = randomHex(32);
    const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
        password: tempPassword,
    });

    if (passwordError) {
        logError('YandexAuth', 'Update password error', passwordError);
        throw new Error('Failed to set password for session');
    }

    const {
        data: { session },
        error: signInError,
    } = await admin.auth.signInWithPassword({
        email: userEmail,
        password: tempPassword,
    });

    if (signInError || !session) {
        logError('YandexAuth', 'signInWithPassword error', signInError);
        throw new Error('Failed to create session');
    }

    const redirectUrl = buildCallbackRedirect({
        origin,
        redirectTo,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
    });

    logDebug('YandexAuth', 'Redirecting to callback with tokens', { userId });
    return { redirectUrl };
}
