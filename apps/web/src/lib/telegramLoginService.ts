import crypto from 'crypto';

import { databaseErrorMessage } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import type { DbClient } from '@/lib/supabaseTypes';
import { issueSessionForVerifiedUser, type VerifiedIdentitySession } from '@/lib/verifiedIdentitySession';

type TelegramNormalizedData = {
    telegram_id: number;
    full_name: string | null;
    telegram_username: string | null;
    telegram_photo_url: string | null;
};

type ProfileRow = {
    id: string;
    telegram_id: number | null;
    full_name: string | null;
};

type TelegramLoginAdminClient = Pick<DbClient, 'from' | 'auth'>;

type TelegramLoginInput = {
    admin: TelegramLoginAdminClient;
    normalized: TelegramNormalizedData;
    randomHex?: (size: number) => string;
    issueSession?: (userId: string) => Promise<VerifiedIdentitySession>;
};

type TelegramLoginResult =
    | {
          ok: true;
          data: {
              userId: string;
              accessToken: string;
              refreshToken: string;
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

async function findExistingProfile(admin: TelegramLoginAdminClient, telegramId: number) {
    const { data, error } = await admin
        .from('profiles')
        .select('id, telegram_id, full_name')
        .eq('telegram_id', telegramId)
        .maybeSingle();

    if (error) {
        logError('TelegramLogin', 'Profile select error', error);
    }

    return data;
}

async function updateExistingProfile(
    admin: TelegramLoginAdminClient,
    profile: ProfileRow,
    normalized: TelegramNormalizedData,
) {
    const providerNameMayFillBlankProfile =
        !profile.full_name?.trim() && !!normalized.full_name?.trim();
    const { error } = await admin
        .from('profiles')
        .update({
            ...(providerNameMayFillBlankProfile ? { full_name: normalized.full_name } : {}),
            telegram_username: normalized.telegram_username,
            telegram_photo_url: normalized.telegram_photo_url,
            telegram_verified: true,
        })
        .eq('id', profile.id);

    if (error) {
        logError('TelegramLogin', 'Profile update error', error);
    }
}

async function createNewTelegramUser(
    admin: TelegramLoginAdminClient,
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
            message: databaseErrorMessage(authError, 'Ошибка создания пользователя'),
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

/** Identity resolution shared with the PKCE grant flow; never rotates credentials. */
export async function resolveTelegramIdentity({
    admin,
    normalized,
    randomHex = defaultRandomHex,
}: TelegramLoginInput) {
    const existingProfile = await findExistingProfile(admin, normalized.telegram_id);
    let userId: string;
    let linkage: 'existing' | 'created';

    if (existingProfile?.id) {
        userId = existingProfile.id;
        linkage = 'existing';
        await updateExistingProfile(admin, existingProfile, normalized);
    } else {
        const creation = await createNewTelegramUser(admin, normalized, randomHex(32));
        if (!creation.ok) {
            return creation;
        }
        userId = creation.userId;
        linkage = 'created';
    }

    return { ok: true as const, userId, linkage };
}

export async function handleTelegramLogin({
    admin,
    normalized,
    randomHex = defaultRandomHex,
    issueSession = issueSessionForVerifiedUser,
}: TelegramLoginInput): Promise<TelegramLoginResult> {
    const identity = await resolveTelegramIdentity({ admin, normalized, randomHex });
    if (!identity.ok) return identity;
    const { userId, linkage } = identity;

    // Never rotate the user's password or return credentials: issue a fresh
    // short-lived session for the verified Telegram identity instead.
    let session: VerifiedIdentitySession;
    try {
        session = await issueSession(userId);
    } catch (error) {
        logError('TelegramLogin', 'Issue session error', error);
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
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            redirect: '/',
            linkage,
        },
    };
}
