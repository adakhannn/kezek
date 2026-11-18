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
// Contacts in free text (ARCH-04): bounded quantifiers and no lookbehind, so the scan stays
// linear on long input without '@' (an HTML error page in a PostgREST message) and runs on
// ES2017 / Hermes. The percent-encoded forms are what PostgREST filters look like in URLs.
const EMAIL_RE = /[A-Z0-9._%+-]{1,64}@[A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63}){0,8}\.[A-Z]{2,24}(?![A-Z0-9-])/gi;
const EMAIL_ENCODED_RE = /[A-Z0-9._%+-]{1,64}%40[A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63}){0,8}\.[A-Z]{2,24}(?![A-Z0-9-])/gi;
const PHONE_RE = /(^|[^\w+-])(\+?\d{9,15})(?![\w-])/g;
const PHONE_ENCODED_RE = /%2B\d{9,15}(?!\d)/gi;
const MAX_TEXT_LENGTH = 2000;

/**
 * Redacts credentials (Bearer, token=..., JWT) and contacts (e-mail, phone, also %40/%2B
 * encoded) in free text and caps it at 2000 characters. Runs of 9-15 digits standing alone
 * (a phone, but also a long numeric id or an epoch-ms timestamp) are masked too; UUIDs, ISO
 * dates and HTTP statuses stay readable.
 */
export function sanitizeText(value: string): string {
    if (!value) {
        return value;
    }

    const capped = value.length > MAX_TEXT_LENGTH ? `${value.slice(0, MAX_TEXT_LENGTH)}…[truncated]` : value;
    return capped
        .replace(BEARER_RE, 'Bearer [REDACTED]')
        .replace(SENSITIVE_ASSIGNMENT_RE, (_match, prefix: string) => `${prefix}[REDACTED]`)
        .replace(JWT_RE, '[REDACTED_JWT]')
        .replace(EMAIL_RE, '[REDACTED_EMAIL]')
        .replace(EMAIL_ENCODED_RE, '[REDACTED_EMAIL]')
        .replace(PHONE_ENCODED_RE, '[REDACTED_PHONE]')
        .replace(PHONE_RE, (_match, lead: string) => `${lead}[REDACTED_PHONE]`);
}

const sanitizeString = sanitizeText;

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
        const safeBase = sanitizeText(base);
        return query ? `${safeBase}?${query}` : safeBase;
    } catch {
        return sanitizeString(String(url));
    }
}

const MAX_LOGGABLE_DEPTH = 6;
const MAX_LOGGABLE_ITEMS = 50;
const MAX_STACK_LINES = 8;
const ERROR_FIELDS = ['status', 'statusCode', 'digest', 'hint', 'details'] as const;

type ErrorLike = {
    name?: unknown;
    message: unknown;
    stack?: unknown;
    code?: unknown;
    cause?: unknown;
    errors?: unknown;
    [key: string]: unknown;
};

function isErrorLike(value: object): value is ErrorLike {
    if (value instanceof Error) return true;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.message === 'string' && ('code' in candidate || 'details' in candidate || 'hint' in candidate);
}

function errorToLoggable(error: ErrorLike, depth: number, seen: WeakSet<object>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (typeof error.name === 'string') out.name = error.name;
    out.message = typeof error.message === 'string' ? error.message : String(error.message);
    // `code` itself is treated as a credential (OAuth code) by sanitizeObject: keep it as errorCode.
    if (error.code !== undefined && error.code !== null) out.errorCode = String(error.code);
    for (const field of ERROR_FIELDS) {
        if (error[field] !== undefined) out[field] = toLoggable(error[field], depth + 1, seen);
    }
    if (typeof error.stack === 'string') out.stack = error.stack.split('\n').slice(0, MAX_STACK_LINES).join('\n');
    if (error.cause !== undefined) out.cause = toLoggable(error.cause, depth + 1, seen);
    if (Array.isArray(error.errors)) out.errors = error.errors.slice(0, 5).map((item) => toLoggable(item, depth + 1, seen));
    for (const [key, item] of Object.entries(error)) {
        if (key in out || key === 'code' || key === 'message' || key === 'stack') continue;
        out[key] = toLoggable(item, depth + 1, seen);
    }
    return out;
}

/**
 * Turns any logged value into plain JSON-safe data (ARCH-04): an Error (or a PostgREST-like
 * error object) keeps name, message, errorCode, status, hint, details, the first stack lines,
 * cause and nested errors - JSON.stringify and sanitizeObject used to reduce it to {}. Dates
 * become ISO strings, URLs are masked, cycles and depth are cut, arrays keep 50 items.
 */
export function toLoggable(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
    if (value === null || value === undefined) return value;
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') return value;
    if (type === 'bigint') return String(value);
    if (type === 'function' || type === 'symbol') return undefined;
    if (depth > MAX_LOGGABLE_DEPTH) return '[Max depth reached]';
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    if (typeof URL !== 'undefined' && value instanceof URL) return maskUrl(value);

    const object = value as object;
    if (seen.has(object)) return '[Circular]';
    seen.add(object);

    if (Array.isArray(object)) {
        const items = object.slice(0, MAX_LOGGABLE_ITEMS).map((item) => toLoggable(item, depth + 1, seen));
        if (object.length > MAX_LOGGABLE_ITEMS) items.push(`[+${object.length - MAX_LOGGABLE_ITEMS} more]`);
        return items;
    }
    if (isErrorLike(object)) return errorToLoggable(object, depth, seen);

    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(object)) {
        out[key] = toLoggable(item, depth + 1, seen);
    }
    return out;
}

/** What a log line or a monitoring event may carry: serialized, then redacted. */
export function safeExtra(value: unknown): unknown {
    return sanitizeObject(toLoggable(value));
}
