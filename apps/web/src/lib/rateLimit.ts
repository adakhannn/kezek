/**
 * Rate limiting utility для API endpoints
 * Использует простой in-memory подход для dev и может быть расширен для продакшена
 */

type RateLimitConfig = {
    maxRequests: number; // Максимальное количество запросов
    windowMs: number; // Окно времени в миллисекундах
    identifier?: string; // Дополнительный идентификатор (например, IP, user_id)
};

type RateLimitResult = {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Timestamp когда лимит сбросится
    retryAfter?: number; // Секунды до следующего запроса
};

// In-memory хранилище для rate limiting (для dev/staging)
// В продакшене лучше использовать Redis или Upstash
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Очистка устаревших записей каждые 5 минут
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, value] of rateLimitStore.entries()) {
            if (value.resetAt < now) {
                rateLimitStore.delete(key);
            }
        }
    }, 5 * 60 * 1000);
}

/**
 * Получает идентификатор для rate limiting из запроса
 */
function getRateLimitIdentifier(req: Request): string {
    // Пытаемся получить IP адрес из заголовков
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip'); // Cloudflare
    
    const ip = forwarded?.split(',')[0]?.trim() 
        || realIp 
        || cfConnectingIp 
        || 'unknown';
    
    return ip;
}

/**
 * Проверяет rate limit для запроса
 */
export async function checkRateLimit(
    req: Request,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const { maxRequests, windowMs, identifier } = config;
    
    // Формируем ключ для rate limiting
    const baseKey = identifier || getRateLimitIdentifier(req);
    const key = `ratelimit:${baseKey}`;
    
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    
    // Если записи нет или она устарела, создаем новую
    if (!entry || entry.resetAt < now) {
        const newEntry = {
            count: 1,
            resetAt: now + windowMs,
        };
        rateLimitStore.set(key, newEntry);
        
        return {
            success: true,
            limit: maxRequests,
            remaining: maxRequests - 1,
            reset: newEntry.resetAt,
        };
    }
    
    // Увеличиваем счетчик
    entry.count += 1;
    
    // Проверяем, не превышен ли лимит
    if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        
        return {
            success: false,
            limit: maxRequests,
            remaining: 0,
            reset: entry.resetAt,
            retryAfter,
        };
    }
    
    return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - entry.count,
        reset: entry.resetAt,
    };
}

/**
 * Middleware для rate limiting в Next.js API routes
 * Возвращает NextResponse с ошибкой 429, если лимит превышен
 */
export async function withRateLimit(
    req: Request,
    config: RateLimitConfig,
    handler: () => Promise<Response>
): Promise<Response> {
    const result = await checkRateLimit(req, config);
    
    if (!result.success) {
        return new Response(
            JSON.stringify({
                ok: false,
                error: 'rate_limit_exceeded',
                message: `Превышен лимит запросов. Попробуйте через ${result.retryAfter} секунд.`,
                retryAfter: result.retryAfter,
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': String(result.limit),
                    'X-RateLimit-Remaining': String(result.remaining),
                    'X-RateLimit-Reset': String(result.reset),
                    'Retry-After': String(result.retryAfter || 0),
                },
            }
        );
    }
    
    // Выполняем handler и добавляем заголовки rate limit
    const response = await handler();
    
    // Добавляем заголовки rate limit к ответу
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Limit', String(result.limit));
    headers.set('X-RateLimit-Remaining', String(result.remaining));
    headers.set('X-RateLimit-Reset', String(result.reset));
    
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

/**
 * Предустановленные конфигурации rate limiting для разных типов endpoints
 */
export const RateLimitConfigs = {
    // Публичные endpoints (бронирование без авторизации)
    public: {
        maxRequests: 10, // 10 запросов
        windowMs: 60 * 1000, // в минуту
    },
    
    // Критичные операции (открытие/закрытие смены)
    critical: {
        maxRequests: 5, // 5 запросов
        windowMs: 60 * 1000, // в минуту
    },
    
    // Обычные операции (добавление клиентов, отметка посещения)
    normal: {
        maxRequests: 30, // 30 запросов
        windowMs: 60 * 1000, // в минуту
    },
    
    // Аутентификация (OTP, вход)
    auth: {
        maxRequests: 5, // 5 запросов
        windowMs: 15 * 60 * 1000, // в 15 минут
    },
} as const;

