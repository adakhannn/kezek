/**
 * Rate limiting utility для API endpoints
 *
 * Использует Upstash Redis для продакшена (serverless-совместимо)
 * Fallback на in-memory хранилище для dev окружения
 *
 * Точечная настройка:
 * - Per-route: используйте routeRateLimit(routeId, RateLimitConfigs.normal) или config.keyPrefix,
 *   чтобы для каждого маршрута был свой счётчик (по IP или по identifier).
 * - Per-user: передайте в config identifier: `user:${userId}` (например из сессии),
 *   тогда лимит считается отдельно по пользователю.
 *
 * Настройка Upstash Redis:
 * 1. Создайте Redis database на https://upstash.com
 * 2. Добавьте переменные окружения:
 *    - UPSTASH_REDIS_REST_URL
 *    - UPSTASH_REDIS_REST_TOKEN
 * 3. Для Vercel: подключите Upstash через интеграцию или добавьте env vars
 */

import { logWarn } from './log';

/**
 * Конфигурация ограничения запросов.
 * @property maxRequests Максимальное количество запросов в окне.
 * @property windowMs Длительность окна в миллисекундах.
 * @property identifier Необязательный идентификатор (по умолчанию — IP из заголовков). Для per-user лимита передайте, например, `user:${userId}`.
 * @property keyPrefix Необязательный префикс ключа. Задаёт отдельный счётчик на маршрут: ключ будет `ratelimit:${keyPrefix}:${identifier}` (per-route лимит).
 */
export type RateLimitConfig = {
    maxRequests: number;
    windowMs: number;
    identifier?: string;
    keyPrefix?: string;
};

/**
 * Результат проверки лимита для конкретного ключа.
 * Используется как для Redis, так и для in-memory реализации.
 */
type RateLimitResult = {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Timestamp когда лимит сбросится
    retryAfter?: number; // Секунды до следующего запроса
};

// In-memory хранилище для dev окружения (fallback)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Очистка устаревших записей каждые 5 минут (только для in-memory)
if (typeof setInterval !== 'undefined' && typeof window === 'undefined') {
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
 * Получает Redis клиент (lazy loading)
 */
async function getRedisClient() {
    // Проверяем наличие Upstash Redis переменных
    const { getUpstashRedisUrl, getUpstashRedisToken } = await import('./env');
    const redisUrl = getUpstashRedisUrl();
    const redisToken = getUpstashRedisToken();
    
    if (!redisUrl || !redisToken) {
        return null; // Fallback на in-memory
    }
    
    try {
        // Динамический импорт @upstash/redis (опциональная зависимость)
        const { Redis } = await import('@upstash/redis');
        return new Redis({
            url: redisUrl,
            token: redisToken,
        });
    } catch (error) {
        // Если пакет не установлен, используем fallback
        logWarn('RateLimit', '@upstash/redis not available, using in-memory fallback', error);
        return null;
    }
}

/**
 * Получает идентификатор для rate limiting из запроса (IP из x-forwarded-for / x-real-ip / cf-connecting-ip).
 * Экспортируется для формирования per-user ключа: например, при наличии сессии передайте identifier: `user:${userId}` в конфиг.
 */
export function getRateLimitIdentifier(req: Request): string {
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
 * Проверяет rate limit используя Redis (если доступен) или in-memory fallback
 */
async function checkRateLimitWithRedis(
    key: string,
    maxRequests: number,
    windowMs: number
): Promise<RateLimitResult | null> {
    const redis = await getRedisClient();
    
    if (!redis) {
        return null; // Fallback на in-memory
    }
    
    try {
        const now = Date.now();
        const windowSeconds = Math.ceil(windowMs / 1000);
        
        // Используем Redis INCR с TTL для атомарной операции
        const count = await redis.incr(key);
        
        // Устанавливаем TTL при первом запросе
        if (count === 1) {
            await redis.expire(key, windowSeconds);
        }
        
        // Получаем TTL для расчета reset времени
        const ttl = await redis.ttl(key);
        const reset = now + (ttl * 1000);
        
        const remaining = Math.max(0, maxRequests - count);
        const success = count <= maxRequests;
        
        if (!success) {
            const retryAfter = Math.ceil(ttl);
            return {
                success: false,
                limit: maxRequests,
                remaining: 0,
                reset,
                retryAfter,
            };
        }
        
        return {
            success: true,
            limit: maxRequests,
            remaining,
            reset,
        };
    } catch (error) {
        // Если Redis недоступен, fallback на in-memory
        logWarn('RateLimit', 'Redis error, falling back to in-memory', error);
        return null;
    }
}

/**
 * Проверяет rate limit используя in-memory хранилище
 */
function checkRateLimitInMemory(
    key: string,
    maxRequests: number,
    windowMs: number
): RateLimitResult {
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
 * Проверяет rate limit для запроса
 */
export async function checkRateLimit(
    req: Request,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const { maxRequests, windowMs, identifier, keyPrefix } = config;
    
    // Формируем ключ для rate limiting (keyPrefix даёт per-route счётчик)
    const baseKey = identifier ?? getRateLimitIdentifier(req);
    const key = keyPrefix ? `ratelimit:${keyPrefix}:${baseKey}` : `ratelimit:${baseKey}`;
    
    // Пытаемся использовать Redis
    const redisResult = await checkRateLimitWithRedis(key, maxRequests, windowMs);
    
    if (redisResult !== null) {
        return redisResult;
    }
    
    // Fallback на in-memory
    return checkRateLimitInMemory(key, maxRequests, windowMs);
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
        // Логируем превышение лимита для мониторинга
        try {
            const identifier = getRateLimitIdentifier(req);
            logWarn('RateLimit', 'Rate limit exceeded', {
                identifier,
                limit: result.limit,
                remaining: result.remaining,
                reset: result.reset,
                retryAfter: result.retryAfter,
            });
        } catch {
            // Игнорируем ошибки логирования, чтобы не мешать основному потоку
        }

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

/**
 * Точечная настройка лимита для маршрута: отдельный счётчик на routeId и опциональные переопределения.
 * Использование: withRateLimit(req, routeRateLimit('api/notify', RateLimitConfigs.normal), handler)
 * или с переопределением: routeRateLimit('api/quick-hold', RateLimitConfigs.public, { maxRequests: 5 })
 */
export function routeRateLimit(
    routeId: string,
    baseConfig: RateLimitConfig,
    overrides?: Partial<RateLimitConfig>
): RateLimitConfig {
    return {
        ...baseConfig,
        ...overrides,
        keyPrefix: routeId,
    };
}
