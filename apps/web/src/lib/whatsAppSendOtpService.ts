import crypto from 'crypto';

import { logError } from '@/lib/log';
import {
  PROFILE_WHATSAPP_OTP_TTL_MS,
  type ProfileWhatsAppOtpStore,
} from '@/lib/profileWhatsAppOtpStore';
import type { DbClient } from '@/lib/supabaseTypes';

export type WhatsAppSendOtpSupabaseLike = Pick<DbClient, 'auth' | 'from'>;

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
  sendMessage: (params: {
    to: string;
    text: string;
    template?: {
      name: string;
      language: string;
      components?: Array<Record<string, unknown>>;
    };
  }) => Promise<void>;
  authTemplateName?: string;
  authTemplateLanguage?: string;
  requireTemplate?: boolean;
  /** Server-only OTP storage; the code is never written to user-editable metadata. */
  otpStore: ProfileWhatsAppOtpStore;
  hashOtp: (code: string) => string;
  generateCode?: () => string;
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

  if (params.requireTemplate && !params.authTemplateName?.trim()) {
    return {
      ok: false,
      error: 'internal',
      message: 'Отправка кода WhatsApp временно недоступна',
      details: { code: 'otp_template_not_configured' },
      status: 503,
    };
  }

  const now = params.now ?? new Date();
  const otpCode = params.generateCode
    ? params.generateCode()
    : crypto.randomInt(100000, 1000000).toString();

  try {
    await params.otpStore.save(user.id, {
      codeHash: params.hashOtp(otpCode),
      phone: phoneE164,
      expiresAt: new Date(now.getTime() + PROFILE_WHATSAPP_OTP_TTL_MS).toISOString(),
      attempts: 0,
    });
  } catch (error) {
    logError('WhatsAppSendOtp', 'Failed to store the OTP code', error);
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
      ...(params.authTemplateName?.trim()
        ? {
            template: {
              name: params.authTemplateName.trim(),
              language: params.authTemplateLanguage?.trim() || 'ru',
              components: [
                {
                  type: 'body',
                  parameters: [{ type: 'text', text: otpCode }],
                },
              ],
            },
          }
        : {}),
    });
  } catch (error) {
    logError('WhatsAppSendOtp', 'Failed to send the OTP message', error);
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
