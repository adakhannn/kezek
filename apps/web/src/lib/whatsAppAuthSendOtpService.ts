export type WhatsAppAuthSendOtpAdminLike = {
  auth: {
    admin: {
      listUsers: () => Promise<{
        data: {
          users: Array<{
            id: string;
            phone?: string | null;
            user_metadata?: Record<string, unknown> | null;
          }>;
        } | null;
      }>;
      updateUserById: (
        userId: string,
        params: {
          user_metadata: Record<string, unknown>;
        },
      ) => Promise<{
        error?: { message: string } | null;
      }>;
    };
  };
  from: (table: string) => {
    insert: (...args: unknown[]) => {
      select: () => {
        single: () => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
};

type SendMessageParams = {
  to: string;
  text: string;
  template?: {
    name: string;
    language: string;
    components?: Array<{
      type: 'body' | 'header' | 'button';
      parameters?: Array<{
        type: 'text';
        text: string;
      }>;
    }>;
  };
};

export type WhatsAppAuthSendOtpResult =
  | { ok: true; data: { message: string } }
  | {
      ok: false;
      error: 'validation' | 'internal';
      message: string;
      status: number;
      details: Record<string, unknown>;
    };

export async function sendWhatsAppAuthOtp(params: {
  admin: WhatsAppAuthSendOtpAdminLike;
  phone: string | undefined;
  normalizePhone: (phone: string) => string | null;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  authTemplateName?: string;
  authTemplateLanguage?: string;
  now?: Date;
  random?: () => number;
}): Promise<WhatsAppAuthSendOtpResult> {
  if (!params.phone) {
    return {
      ok: false,
      error: 'validation',
      message: 'Номер телефона не указан',
      details: { code: 'no_phone' },
      status: 400,
    };
  }

  const phoneE164 = params.normalizePhone(params.phone);
  if (!phoneE164) {
    return {
      ok: false,
      error: 'validation',
      message: 'Неверный формат номера телефона',
      details: { code: 'invalid_phone' },
      status: 400,
    };
  }

  const { data: existingUser } = await params.admin.auth.admin.listUsers();
  const user = existingUser?.users.find(
    (candidate) =>
      candidate.phone === phoneE164 ||
      (candidate.user_metadata as { phone?: string } | null | undefined)?.phone === phoneE164,
  );

  const random = params.random ?? Math.random;
  const otpCode = Math.floor(100000 + random() * 900000).toString();
  const now = params.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  if (user) {
    await params.admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        whatsapp_auth_otp: otpCode,
        whatsapp_auth_otp_expires: expiresAt.toISOString(),
      },
    });
  }

  const message = `Ваш код входа в Kezek: ${otpCode}\n\nКод действителен в течение 10 минут.\n\nЕсли вы не запрашивали этот код, проигнорируйте это сообщение.`;

  const authTemplateName = params.authTemplateName?.trim();
  const authTemplateLanguage = params.authTemplateLanguage?.trim() || 'ru';

  try {
    if (authTemplateName) {
      await params.sendMessage({
        to: phoneE164,
        text: message,
        template: {
          name: authTemplateName,
          language: authTemplateLanguage,
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: otpCode }],
            },
          ],
        },
      });
    } else {
      await params.sendMessage({
        to: phoneE164,
        text: message,
      });
    }
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

  const { error: dbError } = await params.admin
    .from('whatsapp_otp_codes')
    .insert({
      phone: phoneE164,
      code: otpCode,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    })
    .select()
    .single();

  if (dbError && !dbError.message.includes('does not exist')) {
    return {
      ok: false,
      error: 'internal',
      message: dbError.message,
      details: { code: 'otp_db_failed' },
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
