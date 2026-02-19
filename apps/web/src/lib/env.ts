/**
 * Централизованный модуль для работы с переменными окружения
 * Обеспечивает валидацию и безопасный доступ к env переменным
 */

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
 * Получает EMAIL_FROM с дефолтным значением
 */
export function getEmailFrom(): string {
    return getEnvVar('EMAIL_FROM', {
        required: false,
        defaultValue: 'Kezek <noreply@mail.kezek.kg>'
    });
}

/**
 * Получает NEXT_PUBLIC_SITE_ORIGIN
 */
export function getSiteOrigin(): string {
    return getEnvVar('NEXT_PUBLIC_SITE_ORIGIN', {
        required: false,
        defaultValue: 'https://kezek.kg',
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

/**
 * Получает UPSTASH_REDIS_REST_URL
 */
export function getUpstashRedisUrl(): string | undefined {
    return getOptionalEnvVar('UPSTASH_REDIS_REST_URL');
}

/**
 * Получает UPSTASH_REDIS_REST_TOKEN
 */
export function getUpstashRedisToken(): string | undefined {
    return getOptionalEnvVar('UPSTASH_REDIS_REST_TOKEN');
}

