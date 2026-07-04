import { logError } from '@/lib/log';
import { normalizePhoneToE164 } from '@/lib/senders/sms';

type UserLike = {
    id: string;
    user_metadata?: Record<string, unknown> | null;
};

export type SupabaseServerClientLike = {
    // Supabase query builders vary by operation in this small service boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
    auth: {
        getUser: () => Promise<{ data: { user: UserLike | null } }>;
        updateUser: (payload: unknown) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
    };
};

type VerifyExistingOtpInput = {
    supabase: SupabaseServerClientLike;
    user: UserLike;
    code?: string;
};

type VerifyExistingOtpResult =
    | {
          ok: true;
          data: {
              message: string;
          };
      }
    | {
          ok: false;
          error: string;
          message: string;
          details?: unknown;
          status: number;
      };

export async function verifyExistingWhatsAppOtp({
    supabase,
    user,
    code,
}: VerifyExistingOtpInput): Promise<VerifyExistingOtpResult> {
    if (!code || !/^\d{6}$/.test(code)) {
        return {
            ok: false,
            error: 'validation',
            message: 'Неверный формат кода. Введите 6 цифр.',
            details: { code: 'invalid_code' },
            status: 400,
        };
    }

    const userMeta = (user.user_metadata ?? {}) as {
        whatsapp_otp_code?: string;
        whatsapp_otp_expires?: string;
        whatsapp_otp_phone?: string;
    };

    const savedCode = userMeta.whatsapp_otp_code;
    const expiresAt = userMeta.whatsapp_otp_expires;
    const otpPhone = userMeta.whatsapp_otp_phone;

    if (!savedCode) {
        return {
            ok: false,
            error: 'validation',
            message: 'Код не найден. Запросите новый код.',
            details: { code: 'no_code' },
            status: 400,
        };
    }

    if (expiresAt && new Date(expiresAt) < new Date()) {
        return {
            ok: false,
            error: 'validation',
            message: 'Код истек. Запросите новый код.',
            details: { code: 'expired' },
            status: 400,
        };
    }

    if (savedCode !== code) {
        return {
            ok: false,
            error: 'validation',
            message: 'Неверный код. Попробуйте еще раз.',
            details: { code: 'wrong_code' },
            status: 400,
        };
    }

    const normalizedPhone = normalizePhoneToE164(otpPhone);
    if (!normalizedPhone) {
        return {
            ok: false,
            error: 'validation',
            message: 'Укажите корректный номер WhatsApp перед подключением.',
            details: { code: 'invalid_phone' },
            status: 400,
        };
    }

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ whatsapp_phone: normalizedPhone, whatsapp_verified: true })
        .eq('id', user.id);

    if (updateError) {
        logError('WhatsAppVerifyOtp', 'Update profile error', updateError);
        return {
            ok: false,
            error: 'internal',
            message: updateError.message || 'Не удалось обновить профиль',
            details: { code: 'update_failed' },
            status: 500,
        };
    }

    const { error: metaError } = await supabase.auth.updateUser({
        data: {
            whatsapp_otp_code: null,
            whatsapp_otp_expires: null,
            whatsapp_otp_phone: null,
        },
    });

    if (metaError) {
        logError('WhatsAppVerifyOtp', 'Metadata cleanup error', metaError);
    }

    return {
        ok: true,
        data: {
            message: 'WhatsApp номер подтвержден',
        },
    };
}
