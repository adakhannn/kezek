export type ProfileUpdateBody = {
  full_name?: string | null;
  phone?: string | null;
  notify_email?: boolean;
  notify_sms?: boolean;
  notify_whatsapp?: boolean;
  notify_telegram?: boolean;
};

export type ProfileUpdateSupabaseLike = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: {
          id: string;
          user_metadata?: Record<string, unknown> | null;
        } | null;
      };
    }>;
    updateUser: (params: {
      data: Record<string, unknown>;
    }) => Promise<{
      error: { message: string } | null;
    }>;
  };
  from: (table: string) => {
    select?: (...args: unknown[]) => unknown;
    upsert?: (...args: unknown[]) => Promise<{
      error: { message: string } | null;
    }>;
  };
};

export type ProfileUpdateResult =
  | { ok: true; data: undefined }
  | {
      ok: false;
      error: 'auth' | 'validation';
      message: string;
      status: number;
    };

export async function updateProfileSettings(params: {
  supabase: ProfileUpdateSupabaseLike;
  body: ProfileUpdateBody;
}): Promise<ProfileUpdateResult> {
  const {
    data: { user },
  } = await params.supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'auth',
      message: 'Не авторизован',
      status: 401,
    };
  }

  const full_name = params.body.full_name?.trim() || null;
  const phone = params.body.phone?.trim() || null;
  const notify_email = params.body.notify_email ?? true;
  const notify_sms = params.body.notify_sms ?? true;
  const notify_whatsapp = params.body.notify_whatsapp ?? true;
  const notify_telegram = params.body.notify_telegram ?? true;

  const { data: currentProfile } = await (params.supabase.from('profiles') as {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        maybeSingle: <T>() => Promise<{
          data: T | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select('phone, whatsapp_verified')
    .eq('id', user.id)
    .maybeSingle<{ phone: string | null; whatsapp_verified: boolean | null }>();

  const phoneChanged = currentProfile?.phone !== phone;
  const whatsapp_verified = phoneChanged || !phone ? false : (currentProfile?.whatsapp_verified ?? false);

  const meta = (user.user_metadata ?? {}) as { telegram_id?: number | string | null };
  const upsertData: Record<string, unknown> = {
    id: user.id,
    full_name,
    phone,
    notify_email,
    notify_sms,
    notify_whatsapp,
    whatsapp_verified,
    notify_telegram,
  };

  if (meta.telegram_id != null) {
    const telegramId = typeof meta.telegram_id === 'string' ? Number(meta.telegram_id) : meta.telegram_id;
    if (!Number.isNaN(telegramId)) {
      upsertData.telegram_id = telegramId;
      upsertData.telegram_verified = true;
    }
  }

  const { error: profileError } = await (params.supabase.from('profiles') as {
    upsert: (...args: unknown[]) => Promise<{
      error: { message: string } | null;
    }>;
  }).upsert(upsertData, { onConflict: 'id' });

  if (profileError) {
    return {
      ok: false,
      error: 'validation',
      message: profileError.message,
      status: 400,
    };
  }

  const previousMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  await params.supabase.auth.updateUser({
    data: { ...previousMetadata, full_name: full_name || null },
  });

  return {
    ok: true,
    data: undefined,
  };
}
