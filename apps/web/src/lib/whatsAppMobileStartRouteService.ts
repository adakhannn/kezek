import crypto from 'crypto';

import {
    getWhatsAppAuthTemplateLanguage,
    getWhatsAppAuthTemplateName,
    getWhatsAppOtpTemplateComponentsJson,
    getWhatsAppOtpTemplateType,
} from '@/lib/env';
import { logDebug, logWarn } from '@/lib/log';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { trackWhatsAppMobileMetric } from '@/lib/whatsAppMobileMetricsService';
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

function deepReplaceOtpToken(value: unknown, otpCode: string): unknown {
    if (typeof value === 'string') {
        return value.replaceAll('{{OTP_CODE}}', otpCode);
    }

    if (Array.isArray(value)) {
        return value.map((item) => deepReplaceOtpToken(item, otpCode));
    }

    if (value && typeof value === 'object') {
        const output: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            output[key] = deepReplaceOtpToken(nested, otpCode);
        }
        return output;
    }

    return value;
}

function getDefaultTemplateComponents(otpCode: string) {
    return [
        {
            type: 'body',
            parameters: [{ type: 'text', text: otpCode }],
        },
    ];
}

function buildOtpTemplateComponents(otpCode: string): Array<Record<string, unknown>> {
    const componentsJson = getWhatsAppOtpTemplateComponentsJson();
    if (!componentsJson) {
        return getDefaultTemplateComponents(otpCode);
    }

    try {
        const parsed = JSON.parse(componentsJson) as unknown;
        if (!Array.isArray(parsed)) {
            throw new Error('WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON must be a JSON array');
        }

        const replaced = deepReplaceOtpToken(parsed, otpCode);
        if (!Array.isArray(replaced)) {
            throw new Error('WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON replacement produced invalid shape');
        }

        return replaced as Array<Record<string, unknown>>;
    } catch (error) {
        logWarn('WhatsAppMobileStart', 'Invalid WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON, fallback to default', {
            reason: error instanceof Error ? error.message : String(error),
        });
        return getDefaultTemplateComponents(otpCode);
    }
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
    const templateType = getWhatsAppOtpTemplateType();
    if (!authTemplateName) {
        return {
            ok: false,
            status: 503,
            error: 'service_unavailable',
            message: 'WhatsApp OTP шаблон не настроен',
        };
    }

    const otpCode = generateOtpCode();
    const templateComponents = buildOtpTemplateComponents(otpCode);
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
        await trackWhatsAppMobileMetric('mobile_whatsapp_login_started', {
            attemptId: attempt.id,
            phoneHash,
            metadata: { flow: 'mobile_start' },
        });
        logDebug('WhatsAppMobileStart', 'OTP attempt created', {
            attemptId: attempt.id,
            phoneMasked,
            expiresAt: attempt.expires_at,
        });
    } catch (error) {
        await trackWhatsAppMobileMetric('mobile_whatsapp_login_failed', {
            phoneHash,
            metadata: {
                stage: 'attempt_insert',
                reason: error instanceof Error ? error.message : String(error),
            },
        });
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
                components: templateComponents,
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
        await trackWhatsAppMobileMetric('mobile_whatsapp_login_failed', {
            attemptId: attempt.id,
            phoneHash,
            metadata: {
                stage: 'provider_send',
                error: mapped.error,
                status: mapped.status,
            },
        });
        logWarn('WhatsAppMobileStart', 'Provider send failed', {
            attemptId: attempt.id,
            phoneMasked,
            error: mapped.error,
            status: mapped.status,
        });
        return {
            ok: false,
            status: mapped.status,
            error: mapped.error,
            message: mapped.message,
            details: mapped.details,
        };
    }

    await trackWhatsAppMobileMetric('mobile_whatsapp_otp_sent', {
        attemptId: attempt.id,
        phoneHash,
        metadata: {
            template: authTemplateName,
            language: authTemplateLanguage,
            templateType,
        },
    });
    logDebug('WhatsAppMobileStart', 'OTP sent', {
        attemptId: attempt.id,
        phoneMasked,
    });

    return {
        ok: true,
        payload: {
            attemptId: attempt.id,
            maskedDestination: phoneMasked,
            expiresAt: attempt.expires_at,
        },
    };
}
