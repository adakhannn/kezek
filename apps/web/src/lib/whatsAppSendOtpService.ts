export type WhatsAppSendOtpSupabaseLike = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
    }>;
        updateUser: (params: {
      data: {
        whatsapp_otp_code: string;
        whatsapp_otp_expires: string;
        whatsapp_otp_phone: string;
      };
    }) => Promise<{
      error: { message: string } | null;
    }>;
  };
  from: (table: string) => {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        maybeSingle: <T>() => Promise<{
          data: T | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

export type WhatsAppSendOtpResult =
  | { ok: true; data: { message: string } }
  | {
      ok: false;
      error: 'auth' | 'validation' | 'internal';
      message: string;
      status: number;
      details?: Record<string, unknown>;
    };

export async function sendProfileWhatsAppOtp(params: {
  supabase: WhatsAppSendOtpSupabaseLike;
  phone?: string;
  normalizePhone: (phone: string) => string | null;
  sendMessage: (params: { to: string; text: string }) => Promise<void>;
  now?: Date;
}): Promise<WhatsAppSendOtpResult> {
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

  const { data: profile, error: profileError } = await params.supabase
    .from('profiles')
    .select('whatsapp_phone, whatsapp_verified')
    .eq('id', user.id)
    .maybeSingle<{ whatsapp_phone: string | null; whatsapp_verified: boolean | null }>();

  if (profileError) {
    return {
      ok: false,
      error: 'validation',
      message: profileError.message,
      details: { code: 'profile_error' },
      status: 400,
    };
  }

  const requestedPhone = params.phone?.trim() || profile?.whatsapp_phone;
  if (!requestedPhone) {
    return {
      ok: false,
      error: 'validation',
      message: 'Номер WhatsApp не указан',
      details: { code: 'no_phone' },
      status: 400,
    };
  }

  const phoneE164 = params.normalizePhone(requestedPhone);
  if (!phoneE164) {
    return {
      ok: false,
      error: 'validation',
      message: 'Неверный формат номера WhatsApp',
      details: { code: 'invalid_phone' },
      status: 400,
    };
  }

  if (profile?.whatsapp_verified && profile.whatsapp_phone === phoneE164) {
    return {
      ok: false,
      error: 'validation',
      message: 'WhatsApp номер уже подтвержден',
      details: { code: 'already_verified' },
      status: 400,
    };
  }

  const now = params.now ?? new Date();
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const { error: metadataError } = await params.supabase.auth.updateUser({
    data: {
      whatsapp_otp_code: otpCode,
      whatsapp_otp_expires: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
      whatsapp_otp_phone: phoneE164,
    },
  });

  if (metadataError) {
    return {
      ok: false,
      error: 'internal',
      message: 'Не удалось сохранить OTP код',
      details: { code: 'otp_save_failed' },
      status: 500,
    };
  }

  const message = `Ваш код подтверждения WhatsApp для Kezek: ${otpCode}\n\nКод действителен в течение 10 минут.`;

  try {
    await params.sendMessage({
      to: phoneE164,
      text: message,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: 'internal',
      message: `Не удалось отправить код: ${errorMessage}`,
      details: { code: 'send_failed' },
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
      message: 'Код отправлен на WhatsApp',
    },
  };
}
