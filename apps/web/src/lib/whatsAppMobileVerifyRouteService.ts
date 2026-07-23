import { createClient } from '@supabase/supabase-js';

import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { logDebug, logWarn } from '@/lib/log';
import { runMobileExchangePost } from '@/lib/mobileExchangeRouteService';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { createWhatsAppSignInSession } from '@/lib/whatsAppCreateSessionService';
import { findWhatsAppOwnerByPhone } from '@/lib/whatsAppIdentityOwnershipService';
import { trackWhatsAppMobileMetric } from '@/lib/whatsAppMobileMetricsService';
import { hashWhatsappOtp, hashWhatsappPhone, secureEqualHex } from '@/lib/whatsAppOtpHash';

type AuthUser = {
    id: string;
    phone?: string | null;
    user_metadata?: Record<string, unknown> | null;
};

type AdminLike = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: string) => {
                maybeSingle: () => unknown;
            };
        };
        update: (payload: Record<string, unknown>) => {
            eq: (column: string, value: string) => {
                is: (column: string, value: null) => unknown;
            };
            is: (column: string, value: null) => {
                eq: (column: string, value: string) => unknown;
            };
        };
        upsert: (payload: Record<string, unknown>, options: { onConflict: string }) => unknown;
    };
    auth: {
        admin: {
            listUsers: (params?: { page: number; perPage: number }) => Promise<{
                data?: { users?: AuthUser[] } | null;
                error?: { message?: string } | null;
            }>;
            updateUserById: (id: string, payload: unknown) => Promise<unknown>;
            createUser: (payload: unknown) => Promise<{ data?: { user?: AuthUser }; error?: { message?: string } | null }>;
            getUserById: (id: string) => Promise<unknown>;
        };
    };
};

type Failure = {
    ok: false;
    status: number;
    error: string;
    message: string;
    details?: Record<string, unknown>;
};

type Success = {
    ok: true;
    payload: {
        status: 'approved';
        attemptId: string;
        exchangeCode: string;
        expiresAt: string;
        userId: string;
        linkage: 'existing' | 'created';
    };
};

export type WhatsAppMobileVerifyRouteResult = Failure | Success;

type OtpAttemptRow = {
    id: string;
    phone: string;
    phone_hash: string | null;
    otp_hash: string | null;
    code: string | null;
    status: string | null;
    expires_at: string;
    used_at: string | null;
    consumed_at: string | null;
    failed_attempts: number;
    locked_until: string | null;
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 10 * 60 * 1000;

async function getOtpAttemptById(admin: AdminLike, attemptId: string): Promise<OtpAttemptRow | null> {
    const result = (await admin
        .from('whatsapp_otp_codes')
        .select('id, phone, phone_hash, otp_hash, code, status, expires_at, used_at, consumed_at, failed_attempts, locked_until')
        .eq('id', attemptId)
        .maybeSingle()) as { data: unknown; error: { message?: string } | null };
    const { data, error } = result;

    if (error || !data) {
        return null;
    }

    return data as OtpAttemptRow;
}

function isExpired(expiresAtIso: string) {
    return Date.parse(expiresAtIso) <= Date.now();
}

function isLocked(attempt: OtpAttemptRow) {
    if (!attempt.locked_until) return false;
    return Date.parse(attempt.locked_until) > Date.now();
}

async function resolveOrCreateUser(admin: AdminLike, phoneE164: string): Promise<{ userId: string; linkage: 'existing' | 'created' } | Failure> {
    try {
        const ownerId = await findWhatsAppOwnerByPhone(admin as never, phoneE164);
        if (ownerId) {
            return { userId: ownerId, linkage: 'existing' };
        }
    } catch (error) {
        logWarn('WhatsAppMobileVerify', 'WhatsApp identity owner lookup failed', {
            reason: error instanceof Error ? error.message : String(error),
        });
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'Не удалось проверить владельца WhatsApp номера. Попробуйте позже.',
            details: { code: 'owner_lookup_failed' },
        };
    }

    const { data: created, error } = await admin.auth.admin.createUser({
        phone: phoneE164,
        phone_confirm: true,
        user_metadata: { phone: phoneE164 },
    });

    if (error || !created?.user) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: error?.message || 'Не удалось создать пользователя',
        };
    }

    return { userId: created.user.id, linkage: 'created' };
}

async function markAttemptFailed(admin: AdminLike, attempt: OtpAttemptRow) {
    const nextFailedAttempts = (attempt.failed_attempts ?? 0) + 1;
    const lockUntil =
        nextFailedAttempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCK_WINDOW_MS).toISOString()
            : null;

    await admin
        .from('whatsapp_otp_codes')
        .update({
            failed_attempts: nextFailedAttempts,
            locked_until: lockUntil,
            status: nextFailedAttempts >= MAX_FAILED_ATTEMPTS ? 'failed' : 'pending',
        })
        .eq('id', attempt.id)
        .is('used_at', null);

    return { nextFailedAttempts, lockUntil };
}

async function markAttemptConsumed(admin: AdminLike, attemptId: string) {
    const nowIso = new Date().toISOString();
    await admin
        .from('whatsapp_otp_codes')
        .update({
            used_at: nowIso,
            consumed_at: nowIso,
            status: 'consumed',
            failed_attempts: 0,
            locked_until: null,
        })
        .eq('id', attemptId)
        .is('used_at', null);
}

export async function runWhatsAppMobileVerifyRoute({
    admin,
    attemptId,
    code,
    phone,
}: {
    admin: AdminLike;
    attemptId?: string | null;
    code?: string | null;
    phone?: string | null;
}): Promise<WhatsAppMobileVerifyRouteResult> {
    if (!attemptId?.trim() || !code?.trim()) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать attemptId и code',
        };
    }

    if (!/^\d{6}$/.test(code.trim())) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Код должен состоять из 6 цифр',
        };
    }

    const attempt = await getOtpAttemptById(admin, attemptId.trim());
    if (!attempt) {
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'OTP попытка не найдена',
        };
    }

    if (attempt.used_at || attempt.consumed_at || attempt.status === 'consumed') {
        return {
            ok: false,
            status: 409,
            error: 'conflict',
            message: 'OTP уже использован',
        };
    }

    if (isLocked(attempt) || (attempt.failed_attempts ?? 0) >= MAX_FAILED_ATTEMPTS) {
        return {
            ok: false,
            status: 429,
            error: 'rate_limit',
            message: 'Слишком много неверных попыток. Попробуйте позже.',
        };
    }

    if (isExpired(attempt.expires_at)) {
        await admin.from('whatsapp_otp_codes').update({ status: 'expired' }).eq('id', attempt.id);
        await trackWhatsAppMobileMetric('mobile_whatsapp_login_expired', {
            attemptId: attempt.id,
            phoneHash: attempt.phone_hash,
            metadata: { stage: 'verify' },
        });
        return {
            ok: false,
            status: 410,
            error: 'validation',
            message: 'Срок действия OTP истек',
        };
    }

    const normalizedPhone = phone?.trim() ? normalizePhoneToE164(phone.trim()) : attempt.phone;
    if (!normalizedPhone || normalizedPhone !== attempt.phone) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Номер телефона не совпадает с OTP попыткой',
        };
    }

    const inputPhoneHash = hashWhatsappPhone(normalizedPhone);
    if (attempt.phone_hash && !secureEqualHex(inputPhoneHash, attempt.phone_hash)) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Номер телефона не совпадает с OTP попыткой',
        };
    }

    const inputOtpHash = hashWhatsappOtp(code.trim());
    const expectedHash = attempt.otp_hash ?? (attempt.code ? hashWhatsappOtp(attempt.code) : null);

    if (!expectedHash || !secureEqualHex(inputOtpHash, expectedHash)) {
        const failedState = await markAttemptFailed(admin, attempt);
        await trackWhatsAppMobileMetric('mobile_whatsapp_login_failed', {
            attemptId: attempt.id,
            phoneHash: attempt.phone_hash,
            metadata: {
                stage: 'verify',
                reason: 'invalid_code',
                failedAttempts: failedState.nextFailedAttempts,
            },
        });
        if (failedState.nextFailedAttempts >= MAX_FAILED_ATTEMPTS) {
            logWarn('WhatsAppMobileVerify', 'Attempt locked by failed OTP checks', {
                attemptId: attempt.id,
                failedAttempts: failedState.nextFailedAttempts,
                lockedUntil: failedState.lockUntil,
            });
            return {
                ok: false,
                status: 429,
                error: 'rate_limit',
                message: 'Слишком много неверных попыток. Попробуйте позже.',
                details: {
                    code: 'attempt_locked',
                    lockedUntil: failedState.lockUntil,
                },
            };
        }

        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Неверный или истекший код. Запросите новый код.',
            details: { code: 'invalid_code' },
        };
    }

    const userResult = await resolveOrCreateUser(admin, normalizedPhone);
    if ('ok' in userResult) {
        return userResult;
    }
    const resolvedUser = userResult;

    const { error: profileLinkError } = (await admin.from('profiles').upsert(
        {
            id: resolvedUser.userId,
            whatsapp_phone: normalizedPhone,
            whatsapp_verified: true,
        },
        {
            onConflict: 'id',
        },
    )) as { error?: { message?: string } | null };

    if (profileLinkError) {
        logWarn('WhatsAppMobileVerify', 'Failed to persist WhatsApp identity link', {
            userId: resolvedUser.userId,
            reason: profileLinkError.message,
        });
        return {
            ok: false,
            status: 409,
            error: 'conflict',
            message: 'Не удалось привязать WhatsApp номер к аккаунту. Попробуйте войти снова.',
            details: { code: 'identity_link_failed' },
        };
    }

    await markAttemptConsumed(admin, attempt.id);

    const createSessionResult = await createWhatsAppSignInSession({
        admin: admin as never,
        userId: resolvedUser.userId,
    });

    if (!createSessionResult.ok) {
        await trackWhatsAppMobileMetric('mobile_whatsapp_login_failed', {
            attemptId: attempt.id,
            phoneHash: attempt.phone_hash,
            metadata: {
                stage: 'session_prepare',
                error: createSessionResult.error,
                status: createSessionResult.status,
            },
        });
        return {
            ok: false,
            status: createSessionResult.status,
            error: createSessionResult.error,
            message: createSessionResult.message,
            details: createSessionResult.details as Record<string, unknown> | undefined,
        };
    }

    const authClient = createClient(getSupabaseUrl(), getSupabaseAnonKey());
    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
        email: createSessionResult.data.email,
        password: createSessionResult.data.password,
    });

    const accessToken = signInData.session?.access_token;
    const refreshToken = signInData.session?.refresh_token;

    if (signInError || !accessToken || !refreshToken) {
        await trackWhatsAppMobileMetric('mobile_whatsapp_login_failed', {
            attemptId: attempt.id,
            phoneHash: attempt.phone_hash,
            metadata: {
                stage: 'sign_in_with_password',
                reason: signInError?.message || 'missing_tokens',
            },
        });
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'Не удалось подготовить mobile exchange',
            details: {
                code: 'sign_in_failed',
                reason: signInError?.message || 'missing_tokens',
            },
        };
    }

    const exchangeResult = runMobileExchangePost({
        accessToken,
        refreshToken,
    });

    if (!exchangeResult.ok) {
        await trackWhatsAppMobileMetric('mobile_whatsapp_login_failed', {
            attemptId: attempt.id,
            phoneHash: attempt.phone_hash,
            metadata: {
                stage: 'mobile_exchange',
                error: exchangeResult.error,
                status: exchangeResult.status,
            },
        });
        return {
            ok: false,
            status: exchangeResult.status,
            error: exchangeResult.error,
            message: exchangeResult.message,
        };
    }

    await admin
        .from('whatsapp_otp_codes')
        .update({ status: 'approved' })
        .eq('id', attempt.id);
    await trackWhatsAppMobileMetric('mobile_whatsapp_login_success', {
        attemptId: attempt.id,
        phoneHash: attempt.phone_hash,
        metadata: {
            linkage: resolvedUser.linkage,
            userId: resolvedUser.userId,
        },
    });
    logDebug('WhatsAppMobileVerify', 'Mobile WhatsApp login approved', {
        attemptId: attempt.id,
        userId: resolvedUser.userId,
        linkage: resolvedUser.linkage,
    });

    return {
        ok: true,
        payload: {
            status: 'approved',
            attemptId: attempt.id,
            exchangeCode: exchangeResult.payload.code,
            expiresAt: attempt.expires_at,
            userId: resolvedUser.userId,
            linkage: resolvedUser.linkage,
        },
    };
}
