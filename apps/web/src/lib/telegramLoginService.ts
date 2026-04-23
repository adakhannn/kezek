import crypto from 'crypto';

import { logError } from '@/lib/log';

type TelegramNormalizedData = {
    telegram_id: number;
    full_name: string | null;
    telegram_username: string | null;
    telegram_photo_url: string | null;
};

type ProfileRow = {
    id: string | null;
    telegram_id: number | null;
};

export type TelegramLoginAdminClientLike = {
    from: (table: string) => unknown;
    auth: {
        admin: {
            createUser: (payload: unknown) => Promise<{ data?: { user?: { id: string } }; error?: { message?: string } | null }>;
            getUserById: (id: string) => Promise<{ data?: { user?: { email?: string | null } }; error?: { message?: string } | null }>;
            updateUserById: (id: string, payload: unknown) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
        };
    };
};

type TelegramLoginInput = {
    admin: TelegramLoginAdminClientLike;
    normalized: TelegramNormalizedData;
    randomHex?: (size: number) => string;
};

type TelegramLoginResult =
    | {
          ok: true;
          data: {
              userId: string;
              email: string;
              password: string;
              needsSignIn: true;
              redirect: '/';
              linkage: 'existing' | 'created';
          };
      }
    | {
          ok: false;
          error: string;
          message: string;
          details?: unknown;
          status: number;
      };

function defaultRandomHex(size: number) {
    return crypto.randomBytes(size).toString('hex');
}

async function findExistingProfile(admin: TelegramLoginAdminClientLike, telegramId: number) {
    const profileResponse = (admin
        .from('profiles')
        .select('id, telegram_id')
        .eq('telegram_id', telegramId)
        .maybeSingle() as Promise<{ data: ProfileRow | null; error: { message?: string } | null }>);
    const { data, error } = await profileResponse;

    if (error) {
        logError('TelegramLogin', 'Profile select error', error);
    }

    return data;
}

async function updateExistingProfile(admin: TelegramLoginAdminClientLike, userId: string, normalized: TelegramNormalizedData) {
    const { error } = await admin
        .from('profiles')
        .update({
            full_name: normalized.full_name,
            telegram_username: normalized.telegram_username,
            telegram_photo_url: normalized.telegram_photo_url,
            telegram_verified: true,
            updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

    if (error) {
        logError('TelegramLogin', 'Profile update error', error);
    }
}

async function createNewTelegramUser(
    admin: TelegramLoginAdminClientLike,
    normalized: TelegramNormalizedData,
    initialPassword: string
) {
    const tempEmail = `telegram_${normalized.telegram_id}@telegram.local`;
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email: tempEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
            telegram_id: normalized.telegram_id,
            telegram_username: normalized.telegram_username,
            auth_provider: 'telegram',
        },
    });

    if (authError || !authUser?.user) {
        logError('TelegramLogin', 'Auth createUser error', authError);
        return {
            ok: false as const,
            error: 'internal',
            message: authError?.message ?? 'Ошибка создания пользователя',
            details: { code: 'auth_error' },
            status: 500,
        };
    }

    const userId = authUser.user.id;
    const { error: profileInsertError } = await admin.from('profiles').insert({
        id: userId,
        full_name: normalized.full_name,
        telegram_id: normalized.telegram_id,
        telegram_username: normalized.telegram_username,
        telegram_photo_url: normalized.telegram_photo_url,
        telegram_verified: true,
    });

    if (profileInsertError) {
        logError('TelegramLogin', 'Profile insert error', profileInsertError);
    }

    return {
        ok: true as const,
        userId,
    };
}

export async function handleTelegramLogin({
    admin,
    normalized,
    randomHex = defaultRandomHex,
}: TelegramLoginInput): Promise<TelegramLoginResult> {
    const existingProfile = await findExistingProfile(admin, normalized.telegram_id);
    let userId: string;
    let linkage: 'existing' | 'created';

    if (existingProfile?.id) {
        userId = existingProfile.id;
        linkage = 'existing';
        await updateExistingProfile(admin, userId, normalized);
    } else {
        const creation = await createNewTelegramUser(admin, normalized, randomHex(32));
        if (!creation.ok) {
            return creation;
        }
        userId = creation.userId;
        linkage = 'created';
    }

    const tempPassword = randomHex(16);
    const tempEmail = `telegram_${normalized.telegram_id}@telegram.local`;

    const { data: currentUser, error: getUserError } = await admin.auth.admin.getUserById(userId);
    if (getUserError) {
        logError('TelegramLogin', 'GetUserById error', getUserError);
    }

    if (!currentUser?.user?.email) {
        const { error: updateEmailError } = await admin.auth.admin.updateUserById(userId, {
            email: tempEmail,
            email_confirm: true,
        });

        if (updateEmailError) {
            logError('TelegramLogin', 'Update email error', updateEmailError);
        }
    }

    const emailToUse = currentUser?.user?.email ?? tempEmail;
    const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
        password: tempPassword,
    });

    if (passwordError) {
        logError('TelegramLogin', 'Set password error', passwordError);
        return {
            ok: false,
            error: 'internal',
            message: 'Не удалось подготовить сессию',
            details: { code: 'session_error' },
            status: 500,
        };
    }

    return {
        ok: true,
        data: {
            userId,
            email: emailToUse,
            password: tempPassword,
            needsSignIn: true,
            redirect: '/',
            linkage,
        },
    };
}
