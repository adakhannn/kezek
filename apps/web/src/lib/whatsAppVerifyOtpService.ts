import type { SupabaseClient } from '@supabase/supabase-js';

import { logError } from '@/lib/log';
import {
    MAX_PROFILE_WHATSAPP_OTP_ATTEMPTS,
    type ProfileWhatsAppOtpStore,
} from '@/lib/profileWhatsAppOtpStore';
import { normalizePhoneToE164 } from '@/lib/senders/sms';

type UserLike = {
    id: string;
    user_metadata?: Record<string, unknown> | null;
};

export type SupabaseServerClientLike = {
    // Supabase query builders vary by operation in this small service boundary.

    from: SupabaseClient['from'];
    auth: {
        getUser: () => Promise<{ data: { user: UserLike | null } }>;
    };
};

/** Writes verified identity columns; must be a privileged (service-role) client. */
export type ProfileIdentityWriter = {

    from: SupabaseClient['from'];
    rpc(name: string, args: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }>;
};

type VerifyExistingOtpInput = {
    user: UserLike;
    code?: string;
    findAuthOwnerByPhone: (phone: string) => Promise<string | null>;
    otpStore: ProfileWhatsAppOtpStore;
    hashOtp: (code: string) => string;
    secureEqual: (left: string, right: string) => boolean;
    profileWriter: ProfileIdentityWriter;
    now?: Date;
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

function internalError(code: string, message = 'Не удалось проверить код. Попробуйте позже.'): VerifyExistingOtpResult {
    return { ok: false, error: 'internal', message, details: { code }, status: 500 };
}

export async function verifyExistingWhatsAppOtp({
    user,
    code,
    findAuthOwnerByPhone,
    otpStore,
    hashOtp,
    secureEqual,
    profileWriter,
    now = new Date(),
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

    let record;
    try {
        record = await otpStore.load(user.id);
    } catch (error) {
        logError('WhatsAppVerifyOtp', 'OTP load error', error);
        return internalError('otp_load_failed');
    }

    if (!record) {
        return {
            ok: false,
            error: 'validation',
            message: 'Код не найден. Запросите новый код.',
            details: { code: 'no_code' },
            status: 400,
        };
    }

    const clearRecord = async () => {
        try {
            await otpStore.clear(user.id);
        } catch (error) {
            logError('WhatsAppVerifyOtp', 'OTP cleanup error', error);
        }
    };

    if (new Date(record.expiresAt) < now) {
        await clearRecord();
        return {
            ok: false,
            error: 'validation',
            message: 'Код истек. Запросите новый код.',
            details: { code: 'expired' },
            status: 400,
        };
    }

    if (record.attempts >= MAX_PROFILE_WHATSAPP_OTP_ATTEMPTS) {
        await clearRecord();
        return {
            ok: false,
            error: 'rate_limit',
            message: 'Слишком много попыток. Запросите новый код.',
            details: { code: 'too_many_attempts' },
            status: 429,
        };
    }

    if (!secureEqual(hashOtp(code), record.codeHash)) {
        try {
            await otpStore.save(user.id, { ...record, attempts: record.attempts + 1 });
        } catch (error) {
            logError('WhatsAppVerifyOtp', 'OTP attempt save error', error);
            return internalError('otp_attempt_save_failed');
        }
        return {
            ok: false,
            error: 'validation',
            message: 'Неверный код. Попробуйте еще раз.',
            details: { code: 'wrong_code' },
            status: 400,
        };
    }

    const normalizedPhone = normalizePhoneToE164(record.phone);
    if (!normalizedPhone) {
        await clearRecord();
        return {
            ok: false,
            error: 'validation',
            message: 'Укажите корректный номер WhatsApp перед подключением.',
            details: { code: 'invalid_phone' },
            status: 400,
        };
    }

    try {
        const authOwnerId = await findAuthOwnerByPhone(normalizedPhone);
        if (authOwnerId && authOwnerId !== user.id) {
            await clearRecord();
            return {
                ok: false,
                error: 'conflict',
                message: 'Этот WhatsApp номер уже используется другим аккаунтом. Войдите через него или обратитесь в поддержку.',
                details: { code: 'whatsapp_identity_already_linked' },
                status: 409,
            };
        }
    } catch (error) {
        logError('WhatsAppVerifyOtp', 'Auth owner lookup error', error);
        return internalError('auth_owner_lookup_failed', 'Не удалось проверить владельца WhatsApp номера. Попробуйте позже.');
    }

    // A verified number replaced by another one stops being this account's Auth phone (API-10):
    // otherwise its confirmed Auth phone would keep receiving WhatsApp sign-ins.
    const { data: previous, error: previousError } = await profileWriter
        .from('profiles')
        .select('whatsapp_phone, whatsapp_verified')
        .eq('id', user.id)
        .maybeSingle();
    if (previousError) {
        logError('WhatsAppVerifyOtp', 'Profile lookup error', previousError);
        return internalError('profile_lookup_failed');
    }
    const previousDigits = previous?.whatsapp_verified ? String(previous.whatsapp_phone ?? '').replace(/\D/g, '') : '';
    if (/^\d{8,15}$/.test(previousDigits) && previousDigits !== normalizedPhone.slice(1)) {
        const { error: releaseError } = await profileWriter.rpc('release_auth_phone', { p_user_id: user.id, p_phone_digits: previousDigits });
        if (releaseError) {
            logError('WhatsAppVerifyOtp', 'Auth phone release error', releaseError);
            return internalError('auth_phone_release_failed');
        }
    }

    const { error: updateError } = await profileWriter
        .from('profiles')
        .update({ whatsapp_phone: normalizedPhone, whatsapp_verified: true })
        .eq('id', user.id);

    if (updateError) {
        logError('WhatsAppVerifyOtp', 'Update profile error', updateError);
        return internalError('update_failed', 'Не удалось обновить профиль');
    }

    await clearRecord();

    return {
        ok: true,
        data: {
            message: 'WhatsApp номер подтвержден',
        },
    };
}
