export type ProfileUpdateBody = {
  full_name?: string | null;
  phone?: string | null;
  notify_email?: boolean;
  notify_sms?: boolean;
  notify_whatsapp?: boolean;
  notify_telegram?: boolean;
  notification_emails?: string[];
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
  from(table: string): {
    select?: (...args: unknown[]) => unknown;
    upsert?: (...args: unknown[]) => Promise<{
      error: { message: string } | null;
    }>;
  };
  rpc(name: string, params: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
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
  /** Overrides the default auth.updateUser metadata mirror (bearer sessions). */
  updateFullNameMetadata?: (fullName: string | null) => Promise<void>;
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
  const requestedNotifyWhatsApp = params.body.notify_whatsapp ?? true;
  const requestedNotifyTelegram = params.body.notify_telegram ?? true;

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
    .select('whatsapp_phone, whatsapp_verified, telegram_id, telegram_verified')
    .eq('id', user.id)
    .maybeSingle<{
      whatsapp_phone: string | null;
      whatsapp_verified: boolean | null;
      telegram_id: number | null;
      telegram_verified: boolean | null;
    }>();

  const whatsapp_verified = !!currentProfile?.whatsapp_phone && (currentProfile?.whatsapp_verified ?? false);
  const notify_whatsapp = whatsapp_verified && requestedNotifyWhatsApp;
  const telegramConnected = !!currentProfile?.telegram_id && !!currentProfile?.telegram_verified;
  const notify_telegram = telegramConnected && requestedNotifyTelegram;

  // Identity columns (whatsapp_phone/whatsapp_verified, telegram_id/telegram_verified, ...)
  // are written only by provider verification flows with a privileged client.
  // user_metadata is editable by the user and must never be trusted as proof.
  const upsertData: Record<string, unknown> = {
    id: user.id,
    full_name,
    phone,
    notify_email,
    notify_sms,
    notify_whatsapp,
    notify_telegram,
  };

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

  if (params.body.notification_emails) {
    const { error: notificationEmailError } = await params.supabase.rpc(
      'set_my_notification_email_preferences',
      {
        target_enabled: notify_email,
        target_emails: params.body.notification_emails,
      },
    );
    if (notificationEmailError) {
      return {
        ok: false,
        error: 'validation',
        message: notificationEmailError.message,
        status: 400,
      };
    }
  }

  if (params.updateFullNameMetadata) {
    await params.updateFullNameMetadata(full_name || null);
  } else {
    const previousMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    await params.supabase.auth.updateUser({
      data: { ...previousMetadata, full_name: full_name || null },
    });
  }

  return {
    ok: true,
    data: undefined,
  };
}
