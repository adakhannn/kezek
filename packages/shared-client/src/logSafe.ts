/**
 * Утилиты для безопасного логирования
 * Автоматически маскирует чувствительные данные (токены, ключи, пароли)
 * 
 * Используется в web и mobile приложениях
 */

/**
 * Чувствительные поля, которые нужно маскировать
 */
const SENSITIVE_FIELDS = [
    'token',
    'access_token',
    'refresh_token',
    'bearer_token',
    'api_key',
    'apiKey',
    'apikey',
    'secret',
    'secret_key',
    'secretKey',
    'password',
    'passwd',
    'pwd',
    'authorization',
    'auth',
    'key',
    'private_key',
    'privateKey',
    'service_role_key',
    'serviceRoleKey',
    'anon_key',
    'anonKey',
    'supabase_key',
    'supabaseKey',
    'resend_api_key',
    'resendApiKey',
    'whatsapp_access_token',
    'whatsappAccessToken',
    'whatsapp_token',
    'whatsappToken',
    'telegram_token',
    'telegramToken',
    'telegram_signature',
    'telegramSignature',
    'signature',
    'nonce',
    'exchange_code',
    'exchangecode',
    'otp',
    'one_time_code',
    'oneTimeCode',
    'request_id',
    'requestid',
    'session',
    'session_id',
    'sessionId',
    'cookie',
    'cookies',
    'phone',
    'phone_number',
    'phoneNumber',
    'email',
] as const;

/**
 * Маскирует чувствительное значение
 * Показывает первые 4 символа и последние 4 символа, остальное заменяет на *
 * 
 * @param value - Значение для маскирования
 * @param showLength - Показывать ли длину значения
 * @returns Замаскированное значение
 */
function maskSensitiveValue(value: string, showLength = true): string {
    if (!value || value.length === 0) {
        return '***';
    }
    
    // Для очень коротких значений показываем только звездочки
    if (value.length <= 8) {
        return '****';
    }
    
    // Для средних значений показываем первые 2 и последние 2 символа
    if (value.length <= 16) {
        const start = value.slice(0, 2);
        const end = value.slice(-2);
        const masked = '*'.repeat(Math.max(4, value.length - 4));
        return `${start}${masked}${end}`;
    }
    
    // Для длинных значений показываем первые 4 и последние 4 символа
    const start = value.slice(0, 4);
    const end = value.slice(-4);
    const masked = '*'.repeat(Math.max(8, value.length - 8));
    const result = `${start}${masked}${end}`;
    
    return showLength ? `${result} (length: ${value.length})` : result;
}

/**
 * Проверяет, является ли ключ чувствительным
 */
function isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return (
        lowerKey === 'code' ||
        SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))
    );
}

const SENSITIVE_ASSIGNMENT_RE =
    /((?:access_token|refresh_token|bearer_token|api[_-]?key|apikey|secret(?:_key)?|password|authorization|anon[_-]?key|exchange_code|exchangecode|nonce|otp|code)=)([^&#\s]+)/gi;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

function sanitizeString(value: string): string {
    if (!value) {
        return value;
    }

    return value
        .replace(BEARER_RE, 'Bearer [REDACTED]')
        .replace(SENSITIVE_ASSIGNMENT_RE, (_match, prefix: string) => `${prefix}[REDACTED]`)
        .replace(JWT_RE, '[REDACTED_JWT]');
}

/**
 * Рекурсивно очищает объект от чувствительных данных
 * 
 * @param obj - Объект для очистки
 * @param depth - Глубина рекурсии (защита от циклических ссылок)
 * @returns Очищенный объект
 */
export function sanitizeObject(obj: unknown, depth = 0): unknown {
    // Защита от слишком глубокой рекурсии
    if (depth > 10) {
        return '[Max depth reached]';
    }
    
    // Примитивные типы возвращаем как есть
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return obj;
    }
    
    // Массивы обрабатываем рекурсивно
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1));
    }
    
    // Объекты обрабатываем с маскированием чувствительных полей
    if (typeof obj === 'object') {
        const sanitized: Record<string, unknown> = {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (isSensitiveKey(key)) {
                // Маскируем чувствительные поля
                if (typeof value === 'string') {
                    sanitized[key] = maskSensitiveValue(value);
                } else if (value !== null && value !== undefined) {
                    sanitized[key] = '[SENSITIVE_DATA_MASKED]';
                } else {
                    sanitized[key] = value;
                }
            } else {
                // Рекурсивно обрабатываем вложенные объекты
                sanitized[key] = sanitizeObject(value, depth + 1);
            }
        }
        
        return sanitized;
    }
    
    return obj;
}

/**
 * Маскирует токен для безопасного логирования
 * 
 * @param token - Токен для маскирования
 * @returns Замаскированный токен
 */
export function maskToken(token: string | null | undefined): string {
    if (!token) {
        return '[NO_TOKEN]';
    }
    
    return maskSensitiveValue(token, false);
}

/**
 * Маскирует URL, скрывая query параметры с чувствительными данными
 * 
 * @param url - URL для маскирования
 * @returns Замаскированный URL
 */
export function maskUrl(url: string | URL): string {
    try {
        const urlObj = typeof url === 'string' ? new URL(url) : url;
        const base =
            urlObj.origin === 'null'
                ? `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`
                : `${urlObj.origin}${urlObj.pathname}`;
        const sanitizedParams = new URLSearchParams();

        urlObj.searchParams.forEach((value, key) => {
            if (!isSensitiveKey(key)) {
                sanitizedParams.set(key, sanitizeString(value));
            } else {
                sanitizedParams.set(key, '[REDACTED]');
            }
        });

        const query = sanitizedParams.toString();
        return query ? `${base}?${query}` : base;
    } catch {
        return sanitizeString(String(url));
    }
}
