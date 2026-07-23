import { logError } from '@/lib/log';
import type { TelegramAuthData } from '@/lib/telegram/verify';
import { normalizeTelegramData, verifyTelegramAuth } from '@/lib/telegram/verify';

export type TelegramLinkSupabaseLike = {
  from: (table: string) => {
    select?: (...args: unknown[]) => unknown;
    update?: (...args: unknown[]) => unknown;
  };
  auth: {
    admin: {
      updateUserById: (
        userId: string,
        payload: Record<string, unknown>,
      ) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

export type TelegramLinkUser = {
  id: string;
  user_metadata?: Record<string, unknown> | null;
};

export type TelegramLinkResult =
  | { ok: true; data: { message: string } }
  | {
      ok: false;
      error: 'validation' | 'conflict' | 'internal';
      message: string;
      status: number;
      details?: Record<string, unknown>;
    };

export async function linkTelegramAccount(params: {
  admin: TelegramLinkSupabaseLike;
  user: TelegramLinkUser;
  body: TelegramAuthData;
}): Promise<TelegramLinkResult> {
  const { admin, user, body } = params;

  if (!verifyTelegramAuth(body)) {
    return {
      ok: false,
      error: 'validation',
      message: 'Неверная подпись данных Telegram',
      details: { code: 'invalid_signature' },
      status: 400,
    };
  }

  const normalized = normalizeTelegramData(body);

  const existingProfileQuery = admin.from('profiles') as {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        maybeSingle: () => Promise<{
          data: { id: string | null; telegram_id: number | null } | null;
          error: null;
        }>;
      };
    };
  };

  const { data: existingProfile } = await existingProfileQuery
    .select('id, telegram_id')
    .eq('telegram_id', normalized.telegram_id)
    .maybeSingle();

  if (existingProfile && existingProfile.id !== user.id) {
    return {
      ok: false,
      error: 'conflict',
      message: 'Этот Telegram аккаунт уже привязан к другому пользователю',
      details: { code: 'already_linked' },
      status: 400,
    };
  }

  const profileUpdateQuery = admin.from('profiles') as {
    update: (...args: unknown[]) => {
      eq: (...args: unknown[]) => Promise<{ error: { message?: string } | null }>;
    };
  };

  const { error: profileUpdateError } = await profileUpdateQuery
    .update({
      telegram_id: normalized.telegram_id,
      telegram_username: normalized.telegram_username,
      telegram_photo_url: normalized.telegram_photo_url,
      telegram_verified: true,
    })
    .eq('id', user.id);

  if (profileUpdateError) {
    logError('TelegramLink', 'Profile update error', profileUpdateError);
    return {
      ok: false,
      error: 'internal',
      message: profileUpdateError.message || 'Не удалось привязать Telegram',
      details: { code: 'update_error' },
      status: 500,
    };
  }

  const prevMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...prevMeta,
      telegram_id: normalized.telegram_id,
      telegram_username: normalized.telegram_username,
    },
  });

  if (metaError) {
    logError('TelegramLink', 'Metadata update error', metaError);
  }

  return {
    ok: true,
    data: { message: 'Telegram успешно привязан' },
  };
}
