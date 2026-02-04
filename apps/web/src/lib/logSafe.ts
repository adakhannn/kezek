/**
 * Утилиты для безопасного логирования
 * Автоматически маскирует чувствительные данные (токены, ключи, пароли)
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
    'session',
    'session_id',
    'sessionId',
    'cookie',
    'cookies',
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
    return SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()));
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
        return obj;
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
 * Безопасно логирует данные, автоматически маскируя чувствительную информацию
 * 
 * @param scope - Область логирования (например, 'QuickHold')
 * @param message - Сообщение
 * @param data - Данные для логирования (будут очищены от чувствительной информации)
 */
export function logSafe(scope: string, message: string, data?: unknown): void {
    const sanitized = data !== undefined ? sanitizeObject(data) : undefined;
    
    // eslint-disable-next-line no-console
    console.log(`[${scope}] ${message}`, sanitized ?? '');
}

/**
 * Безопасно логирует ошибку
 */
export function logErrorSafe(scope: string, message: string, error?: unknown): void {
    const sanitizedError = error !== undefined ? sanitizeObject(error) : undefined;
    
    console.error(`[${scope}] ${message}`, sanitizedError ?? '');
}

/**
 * Безопасно логирует предупреждение
 */
export function logWarnSafe(scope: string, message: string, data?: unknown): void {
    const sanitized = data !== undefined ? sanitizeObject(data) : undefined;
    
    console.warn(`[${scope}] ${message}`, sanitized ?? '');
}

/**
 * Безопасно логирует debug информацию (только в dev)
 */
export function logDebugSafe(scope: string, message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'production') {
        return;
    }
    
    const sanitized = data !== undefined ? sanitizeObject(data) : undefined;
    
    // eslint-disable-next-line no-console
    console.log(`[${scope}] ${message}`, sanitized ?? '');
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
        const sanitized = new URL(urlObj.origin + urlObj.pathname);
        
        // Копируем только безопасные query параметры
        urlObj.searchParams.forEach((value, key) => {
            if (!isSensitiveKey(key)) {
                sanitized.searchParams.set(key, value);
            } else {
                sanitized.searchParams.set(key, maskSensitiveValue(value, false));
            }
        });
        
        return sanitized.toString();
    } catch {
        return '[INVALID_URL]';
    }
}

