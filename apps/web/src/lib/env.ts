/**
 * Централизованный модуль для работы с переменными окружения
 * Обеспечивает валидацию и безопасный доступ к env переменным
 */

import { DEFAULT_SITE_ORIGIN } from './siteOrigin';

type EnvVarConfig = {
    required?: boolean;
    defaultValue?: string;
    validator?: (value: string) => boolean;
    errorMessage?: string;
};

/**
 * Получает значение переменной окружения с валидацией
 * 
 * @param key - Имя переменной окружения
 * @param config - Конфигурация валидации
 * @returns Значение переменной или defaultValue
 * @throws Error если переменная обязательна и не задана
 */
export function getEnvVar(
    key: string,
    config: EnvVarConfig = {}
): string {
    const { required = true, defaultValue, validator, errorMessage } = config;
    const value = process.env[key];

    // Если значение не задано
    if (!value || value.trim() === '') {
        if (required) {
            throw new Error(
                errorMessage || 
                `Missing required environment variable: ${key}. Please set it in your .env.local file.`
            );
        }
        return defaultValue || '';
    }

    // Если есть валидатор, проверяем значение
    if (validator && !validator(value)) {
        throw new Error(
            errorMessage || 
            `Invalid value for environment variable ${key}: ${value}`
        );
    }

    return value;
}

/**
 * Получает опциональную переменную окружения
 */
export function getOptionalEnvVar(key: string, defaultValue = ''): string {
    return getEnvVar(key, { required: false, defaultValue });
}

/**
 * Валидатор для URL
 */
function isValidUrl(value: string): boolean {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Валидатор для непустой строки
 */
function isNonEmpty(value: string): boolean {
    return value.trim().length > 0;
}

// Предопределенные функции для часто используемых переменных

/**
 * Получает NEXT_PUBLIC_SUPABASE_URL
 */
export function getSupabaseUrl(): string {
    return getEnvVar('NEXT_PUBLIC_SUPABASE_URL', {
        required: true,
        validator: isValidUrl,
        errorMessage: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL'
    });
}

/**
 * Получает NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function getSupabaseAnonKey(): string {
    return getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', {
        required: true,
        validator: isNonEmpty,
        errorMessage: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'
    });
}

/**
 * Получает SUPABASE_SERVICE_ROLE_KEY (только для server-side)
 * 
 * ⚠️ КРИТИЧЕСКИ ВАЖНО: Этот ключ обходит все RLS политики и имеет полный доступ к БД.
 * НИКОГДА не используйте его в:
 * - Client components ('use client')
 * - Браузерном коде
 * - Публичных API endpoints без дополнительной авторизации
 * 
 * Используйте только в:
 * - Server components (по умолчанию в Next.js App Router)
 * - API routes (route.ts)
 * - Server Actions
 * - Middleware (с осторожностью)
 * 
 * @throws Error если вызывается в клиентском коде (определяется через typeof window)
 */
/** Whether the service-role key is configured (server only; never exposes the value). */
export function isSupabaseServiceRoleConfigured(): boolean {
    return typeof window === 'undefined' && !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}

export function getSupabaseServiceRoleKey(): string {
    // Защита от использования в клиентском коде
    if (typeof window !== 'undefined') {
        throw new Error(
            'SUPABASE_SERVICE_ROLE_KEY cannot be used in client-side code. ' +
            'This is a security violation. Use API routes or server components instead.'
        );
    }
    
    return getEnvVar('SUPABASE_SERVICE_ROLE_KEY', {
        required: true,
        validator: isNonEmpty,
        errorMessage: 'SUPABASE_SERVICE_ROLE_KEY is required for server-side operations'
    });
}

/**
 * Получает RESEND_API_KEY
 */
export function getResendApiKey(): string {
    return getEnvVar('RESEND_API_KEY', {
        required: true,
        validator: isNonEmpty,
        errorMessage: 'RESEND_API_KEY is required for email sending'
    });
}

/**
 * Получает EMAIL_FROM. Значения по умолчанию нет: домен отправителя должен
 * принадлежать проекту и быть подтверждён в Resend. Пустая строка означает,
 * что email-уведомления не отправляются.
 */
export function getEmailFrom(): string {
    return getEnvVar('EMAIL_FROM', { required: false });
}

/**
 * Получает NEXT_PUBLIC_SITE_ORIGIN
 */
export function getSiteOrigin(): string {
    return getEnvVar('NEXT_PUBLIC_SITE_ORIGIN', {
        required: false,
        defaultValue: DEFAULT_SITE_ORIGIN,
        validator: isValidUrl
    });
}

/**
 * Получает WHATSAPP_ACCESS_TOKEN
 */
export function getWhatsAppAccessToken(): string {
    return getEnvVar('WHATSAPP_ACCESS_TOKEN', {
        required: false,
        validator: isNonEmpty
    });
}

/**
 * Получает WHATSAPP_PHONE_NUMBER_ID
 */
export function getWhatsAppPhoneNumberId(): string {
    return getEnvVar('WHATSAPP_PHONE_NUMBER_ID', {
        required: false,
        validator: isNonEmpty
    });
}

/**
 * Получает имя template для OTP входа через WhatsApp
 */
export function getWhatsAppAuthTemplateName(): string {
    const otpTemplateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
    if (otpTemplateName && otpTemplateName.trim().length > 0) {
        return otpTemplateName.trim();
    }

    return getEnvVar('WHATSAPP_AUTH_TEMPLATE_NAME', {
        required: false,
        defaultValue: '',
    });
}

/**
 * Получает language code для template OTP входа через WhatsApp
 */
export function getWhatsAppAuthTemplateLanguage(): string {
    const otpTemplateLanguage = process.env.WHATSAPP_OTP_TEMPLATE_LANG;
    if (otpTemplateLanguage && otpTemplateLanguage.trim().length > 0) {
        return otpTemplateLanguage.trim();
    }

    return getEnvVar('WHATSAPP_AUTH_TEMPLATE_LANGUAGE', {
        required: false,
        defaultValue: 'ru',
    });
}

/** Optional template settings for workflow notifications. Empty names mean the
 * corresponding channel is not enabled yet, while Email and Telegram continue
 * to work independently. */
export function getWhatsAppTemplateName(key: 'staff_owner' | 'staff_applicant' | 'staff_approved' | 'business_applicant' | 'business_admin' | 'business_approved' | 'owner_applicant' | 'owner_admin' | 'owner_approved'): string {
    const names: Record<typeof key, string | undefined> = {
        staff_owner: process.env.WHATSAPP_STAFF_APPLICATION_OWNER_TEMPLATE_NAME,
        staff_applicant: process.env.WHATSAPP_STAFF_APPLICATION_APPLICANT_TEMPLATE_NAME,
        staff_approved: process.env.WHATSAPP_STAFF_APPLICATION_APPROVED_TEMPLATE_NAME,
        business_applicant: process.env.WHATSAPP_BUSINESS_APPLICATION_APPLICANT_TEMPLATE_NAME,
        business_admin: process.env.WHATSAPP_BUSINESS_APPLICATION_ADMIN_TEMPLATE_NAME,
        business_approved: process.env.WHATSAPP_BUSINESS_APPLICATION_APPROVED_TEMPLATE_NAME,
        owner_applicant: process.env.WHATSAPP_OWNER_APPLICATION_APPLICANT_TEMPLATE_NAME,
        owner_admin: process.env.WHATSAPP_OWNER_APPLICATION_ADMIN_TEMPLATE_NAME,
        owner_approved: process.env.WHATSAPP_OWNER_APPLICATION_APPROVED_TEMPLATE_NAME,
    };
    return names[key]?.trim() ?? '';
}

export function getWhatsAppTemplateLanguage(): string {
    return process.env.WHATSAPP_APPLICATION_TEMPLATE_LANGUAGE?.trim() || 'ru';
}

/**
 * Получает стратегию шаблона OTP для WhatsApp mobile auth.
 * Поддерживаемые значения:
 * - `utility` (по умолчанию)
 * - `authentication`
 */
export function getWhatsAppOtpTemplateType(): 'utility' | 'authentication' {
    const raw = getEnvVar('WHATSAPP_OTP_TEMPLATE_TYPE', {
        required: false,
        defaultValue: 'utility',
    })
        .trim()
        .toLowerCase();

    return raw === 'authentication' ? 'authentication' : 'utility';
}

/**
 * Опциональный JSON-компонентов шаблона OTP.
 * Используется для гибкой миграции между UTILITY и AUTHENTICATION без правок кода.
 *
 * В JSON можно использовать плейсхолдер `{{OTP_CODE}}`, он будет заменен фактическим кодом.
 */
export function getWhatsAppOtpTemplateComponentsJson(): string {
    return getEnvVar('WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON', {
        required: false,
        defaultValue: '',
    }).trim();
}

/**
 * Получает NEXT_PUBLIC_TZ
 */
export function getTimezone(): string {
    return getEnvVar('NEXT_PUBLIC_TZ', {
        required: false,
        defaultValue: 'Asia/Bishkek'
    });
}

/**
 * Получает YANDEX_MAPS_API_KEY
 */
export function getYandexMapsApiKey(): string | undefined {
    return getOptionalEnvVar('NEXT_PUBLIC_YANDEX_MAPS_API_KEY');
}

/**
 * Получает WHATSAPP_VERIFY_TOKEN
 */
export function getWhatsAppVerifyToken(): string {
    return getEnvVar('WHATSAPP_VERIFY_TOKEN', {
        required: false,
        defaultValue: 'kezek_whatsapp_verify',
        validator: isNonEmpty
    });
}

/** Development-only HMAC key. It is public (it is in this repository), so production never uses it. */
const DEV_WHATSAPP_OTP_HASH_SECRET = 'kezek_whatsapp_otp_dev_secret';

/**
 * True when a real WHATSAPP_OTP_HASH_SECRET is configured, or outside production.
 * Every WhatsApp OTP flow checks this first and answers 503 when it is false: with
 * the public development key a 6-digit code and a phone number are trivially
 * recovered offline from their HMAC.
 */
export function hasUsableWhatsAppOtpHashSecret(): boolean {
    const value = process.env.WHATSAPP_OTP_HASH_SECRET?.trim();
    if (value) return true;
    return process.env.NODE_ENV !== 'production';
}

/**
 * HMAC key for WhatsApp OTP codes and phone numbers. Outside production it falls back
 * to the development key; in production a missing secret is an error, never a fallback.
 */
export function getWhatsAppOtpHashSecret(): string {
    const value = process.env.WHATSAPP_OTP_HASH_SECRET;
    if (value && isNonEmpty(value)) return value;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('WHATSAPP_OTP_HASH_SECRET is not configured');
    }
    return DEV_WHATSAPP_OTP_HASH_SECRET;
}

/**
 * Получает UPSTASH_REDIS_REST_URL. Интеграция Upstash из Vercel Marketplace
 * создаёт KV_REST_API_URL — принимается как запасное имя.
 */
export function getUpstashRedisUrl(): string | undefined {
    return getOptionalEnvVar('UPSTASH_REDIS_REST_URL') || getOptionalEnvVar('KV_REST_API_URL');
}

/**
 * Получает UPSTASH_REDIS_REST_TOKEN (запасное имя — KV_REST_API_TOKEN, см. выше).
 */
export function getUpstashRedisToken(): string | undefined {
    return getOptionalEnvVar('UPSTASH_REDIS_REST_TOKEN') || getOptionalEnvVar('KV_REST_API_TOKEN');
}

