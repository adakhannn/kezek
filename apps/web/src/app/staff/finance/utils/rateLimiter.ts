/**
 * Утилита для rate limiting на клиенте
 * Предотвращает слишком частые запросы к API
 */

import { logWarn } from '@/lib/log';

interface RateLimiterOptions {
    maxRequests: number; // Максимальное количество запросов
    windowMs: number; // Окно времени в миллисекундах
    onLimitExceeded?: (retryAfter: number) => void; // Callback при превышении лимита
}

interface RequestRecord {
    timestamp: number;
}

/**
 * Класс для rate limiting запросов
 */
class RateLimiter {
    private requests: RequestRecord[] = [];
    private readonly maxRequests: number;
    private readonly windowMs: number;
    private readonly onLimitExceeded?: (retryAfter: number) => void;
    private isBlocked: boolean = false;
    private blockUntil: number = 0;

    constructor(options: RateLimiterOptions) {
        this.maxRequests = options.maxRequests;
        this.windowMs = options.windowMs;
        this.onLimitExceeded = options.onLimitExceeded;
    }

    /**
     * Проверяет, можно ли выполнить запрос
     * @returns true, если запрос можно выполнить, false если превышен лимит
     */
    canMakeRequest(): boolean {
        const now = Date.now();

        // Если заблокировано, проверяем, истекла ли блокировка
        if (this.isBlocked && now < this.blockUntil) {
            return false;
        }

        // Снимаем блокировку, если время истекло
        if (this.isBlocked && now >= this.blockUntil) {
            this.isBlocked = false;
            this.blockUntil = 0;
        }

        // Удаляем старые записи (старше окна времени)
        const cutoff = now - this.windowMs;
        this.requests = this.requests.filter(r => r.timestamp > cutoff);

        // Проверяем, не превышен ли лимит
        if (this.requests.length >= this.maxRequests) {
            // Вычисляем время до следующего возможного запроса
            const oldestRequest = this.requests[0];
            const retryAfter = oldestRequest.timestamp + this.windowMs - now;

            // Блокируем на время retryAfter
            this.isBlocked = true;
            this.blockUntil = now + retryAfter;

            logWarn('RateLimiter', `Rate limit exceeded. Blocking requests for ${retryAfter}ms`, {
                requestsCount: this.requests.length,
                maxRequests: this.maxRequests,
                windowMs: this.windowMs,
                retryAfter
            });

            // Вызываем callback, если он есть
            this.onLimitExceeded?.(retryAfter);

            return false;
        }

        return true;
    }

    /**
     * Регистрирует выполненный запрос
     */
    recordRequest(): void {
        const now = Date.now();
        this.requests.push({ timestamp: now });

        // Удаляем старые записи
        const cutoff = now - this.windowMs;
        this.requests = this.requests.filter(r => r.timestamp > cutoff);
    }

    /**
     * Возвращает время до следующего возможного запроса в миллисекундах
     * @returns 0, если запрос можно выполнить сейчас, иначе время ожидания
     */
    getRetryAfter(): number {
        if (!this.isBlocked) {
            return 0;
        }

        const now = Date.now();
        if (now >= this.blockUntil) {
            return 0;
        }

        return this.blockUntil - now;
    }

    /**
     * Сбрасывает состояние rate limiter
     */
    reset(): void {
        this.requests = [];
        this.isBlocked = false;
        this.blockUntil = 0;
    }

    /**
     * Возвращает текущее количество запросов в окне
     */
    getCurrentCount(): number {
        const now = Date.now();
        const cutoff = now - this.windowMs;
        this.requests = this.requests.filter(r => r.timestamp > cutoff);
        return this.requests.length;
    }
}

// Глобальный rate limiter для всех API запросов
// Максимум 10 запросов в секунду (1000ms окно)
const globalRateLimiter = new RateLimiter({
    maxRequests: 10,
    windowMs: 1000,
});

/**
 * Проверяет, можно ли выполнить запрос с учетом rate limiting
 * @param scope - область запроса (для логирования)
 * @returns true, если запрос можно выполнить
 */
export function checkRateLimit(scope?: string): boolean {
    const canMake = globalRateLimiter.canMakeRequest();
    
    if (!canMake) {
        const retryAfter = globalRateLimiter.getRetryAfter();
        logWarn(scope || 'RateLimit', `Rate limit exceeded. Retry after ${retryAfter}ms`);
    }
    
    return canMake;
}

/**
 * Регистрирует выполненный запрос
 */
export function recordRequest(): void {
    globalRateLimiter.recordRequest();
}

/**
 * Возвращает время до следующего возможного запроса в миллисекундах
 */
export function getRetryAfter(): number {
    return globalRateLimiter.getRetryAfter();
}

/**
 * Сбрасывает состояние rate limiter (для тестирования или принудительного сброса)
 */
export function resetRateLimiter(): void {
    globalRateLimiter.reset();
}

/**
 * Возвращает текущее количество запросов в окне
 */
export function getCurrentRequestCount(): number {
    return globalRateLimiter.getCurrentCount();
}

/**
 * Создает новый rate limiter с кастомными настройками
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
    return new RateLimiter(options);
}

