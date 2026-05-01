import crypto from 'crypto';

import { getWhatsAppAuthTemplateLanguage, getWhatsAppAuthTemplateName } from '@/lib/env';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { mapWhatsAppProviderError } from '@/lib/whatsAppMobileProviderErrorMapping';
import { hashWhatsappOtp, hashWhatsappPhone } from '@/lib/whatsAppOtpHash';

type AdminLike = {
    from: (table: string) => {
        insert: (payload: Record<string, unknown>) => {
            select: (columns: string) => {
                single: () => unknown;
            };
        };
        update: (payload: Record<string, unknown>) => {
            eq: (column: string, value: string) => unknown;
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
        attemptId: string;
        maskedDestination: string;
        expiresAt: string;
    };
};

export type WhatsAppMobileStartRouteResult = Failure | Success;

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;

function now() {
    return Date.now();
}

function maskPhoneE164(phoneE164: string) {
    const digits = phoneE164.replace(/\D/g, '');
    if (digits.length <= 4) {
        return `+${digits}`;
    }
    const last4 = digits.slice(-4);
    return `+${'*'.repeat(Math.max(0, digits.length - 4))}${last4}`;
}

function generateOtpCode() {
    const min = 10 ** (OTP_LENGTH - 1);
    const max = 10 ** OTP_LENGTH - 1;
    return String(crypto.randomInt(min, max + 1));
}

async function insertOtpAttempt({
    admin,
    phone,
    phoneMasked,
    phoneHash,
    code,
    otpHash,
    expiresAtIso,
}: {
    admin: AdminLike;
    phone: string;
    phoneMasked: string;
    phoneHash: string;
    code: string;
    otpHash: string;
    expiresAtIso: string;
}) {
    const result = (await admin
        .from('whatsapp_otp_codes')
        .insert({
            phone,
            phone_masked: phoneMasked,
            phone_hash: phoneHash,
            code,
            otp_hash: otpHash,
            status: 'pending',
            expires_at: expiresAtIso,
            consumed_at: null,
            failed_attempts: 0,
            locked_until: null,
        })
        .select('id, expires_at')
        .single()) as { data: unknown; error: { message?: string } | null };
    const { data, error } = result;

    if (error || !data) {
        throw new Error(error?.message || 'Не удалось создать OTP попытку');
    }

    return data as { id: string; expires_at: string };
}

export async function runWhatsAppMobileStartRoute({
    admin,
    phone,
}: {
    admin: AdminLike;
    phone?: string | null;
}): Promise<WhatsAppMobileStartRouteResult> {
    if (!phone?.trim()) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать номер телефона',
        };
    }

    const phoneE164 = normalizePhoneToE164(phone);
    if (!phoneE164) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Неверный формат номера телефона. Ожидается E.164',
        };
    }

    const authTemplateName = getWhatsAppAuthTemplateName();
    const authTemplateLanguage = getWhatsAppAuthTemplateLanguage();
    if (!authTemplateName) {
        return {
            ok: false,
            status: 503,
            error: 'service_unavailable',
            message: 'WhatsApp OTP шаблон не настроен',
        };
    }

    const otpCode = generateOtpCode();
    const otpHash = hashWhatsappOtp(otpCode);
    const phoneHash = hashWhatsappPhone(phoneE164);
    const phoneMasked = maskPhoneE164(phoneE164);
    const expiresAt = new Date(now() + OTP_TTL_MS).toISOString();

    let attempt: { id: string; expires_at: string };
    try {
        attempt = await insertOtpAttempt({
            admin,
            phone: phoneE164,
            phoneMasked,
            phoneHash,
            code: otpCode,
            otpHash,
            expiresAtIso: expiresAt,
        });
    } catch (error) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: error instanceof Error ? error.message : 'Не удалось создать OTP попытку',
        };
    }

    try {
        await sendWhatsApp({
            to: phoneE164,
            text: `Ваш код входа: ${otpCode}`,
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
    } catch (error) {
        await admin
            .from('whatsapp_otp_codes')
            .update({
                used_at: new Date().toISOString(),
                consumed_at: new Date().toISOString(),
                status: 'failed',
            })
            .eq('id', attempt.id);
        const mapped = mapWhatsAppProviderError(error);
        return {
            ok: false,
            status: mapped.status,
            error: mapped.error,
            message: mapped.message,
            details: mapped.details,
        };
    }

    return {
        ok: true,
        payload: {
            attemptId: attempt.id,
            maskedDestination: phoneMasked,
            expiresAt: attempt.expires_at,
        },
    };
}
