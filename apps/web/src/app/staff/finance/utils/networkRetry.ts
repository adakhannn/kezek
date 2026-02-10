/**
 * Утилиты для обработки сетевых ошибок и повторных попыток
 */

import { logError, logWarn } from '@/lib/log';
import { checkRateLimit, recordRequest, getRetryAfter } from './rateLimiter';

/**
 * Проверяет, является ли ошибка сетевой (например, недоступен интернет или сервер)
 */
export function isNetworkError(e: unknown): boolean {
    if (e instanceof TypeError) {
        // Fetch в браузере выбрасывает TypeError при проблемах сети / CORS
        const message = e.message?.toLowerCase() || '';
        return message.includes('failed to fetch') || 
               message.includes('networkerror') ||
               message.includes('network request failed') ||
               message.includes('load failed');
    }
    
    if (e instanceof Error) {
        const message = e.message?.toLowerCase() || '';
        const name = e.name?.toLowerCase() || '';
        
        // Проверяем различные типы сетевых ошибок
        if (name === 'networkerror' || name === 'typeerror') {
            return true;
        }
        
        if (message.includes('failed to fetch') ||
            message.includes('networkerror') ||
            message.includes('network request failed') ||
            message.includes('load failed') ||
            message.includes('connection') ||
            message.includes('timeout')) {
            return true;
        }
    }
    
    if (e && typeof e === 'object' && 'code' in e) {
        const anyErr = e as { code?: string };
        // Некоторые драйверы могут использовать такие коды для сетевых ошибок
        if (anyErr.code === 'ECONNABORTED' || 
            anyErr.code === 'ECONNREFUSED' || 
            anyErr.code === 'ENETUNREACH' ||
            anyErr.code === 'ETIMEDOUT') {
            return true;
        }
    }
    
    return false;
}

/**
 * Проверяет, является ли ошибка ошибкой отмены запроса (AbortError)
 */
export function isAbortError(e: unknown): boolean {
    if (e instanceof Error) {
        return e.name === 'AbortError' || 
               e.message?.toLowerCase().includes('aborted') ||
               e.message?.toLowerCase().includes('abort');
    }
    return false;
}

/**
 * Проверяет, является ли HTTP статус код временной ошибкой, которую стоит повторить
 */
export function isRetryableHttpStatus(status: number): boolean {
    // Повторяем для временных ошибок сервера и rate limiting
    return status === 429 || // Too Many Requests
           status === 502 || // Bad Gateway
           status === 503 || // Service Unavailable
           status === 504;   // Gateway Timeout
}

/**
 * Вычисляет задержку для повторной попытки с экспоненциальной задержкой
 * @param attemptNumber - номер попытки (начинается с 0)
 * @param baseDelayMs - базовая задержка в миллисекундах (по умолчанию 1000)
 * @param maxDelayMs - максимальная задержка в миллисекундах (по умолчанию 10000)
 * @returns задержка в миллисекундах
 */
export function calculateRetryDelay(
    attemptNumber: number,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 10000
): number {
    // Экспоненциальная задержка: baseDelay * 2^attemptNumber
    const delay = baseDelayMs * Math.pow(2, attemptNumber);
    // Ограничиваем максимальной задержкой
    return Math.min(delay, maxDelayMs);
}

/**
 * Универсальный helper для повторной попытки при сетевых ошибках и временных ошибках сервера
 * @param fn - функция, которую нужно выполнить с повторными попытками
 * @param options - опции для retry
 * @returns результат выполнения функции
 */
export async function withNetworkRetry<T>(
    fn: () => Promise<T>,
    options?: { 
        retries?: number; 
        baseDelayMs?: number;
        maxDelayMs?: number;
        scope?: string;
        onRetry?: (attempt: number, error: unknown) => void;
    }
): Promise<T> {
    const retries = options?.retries ?? 3;
    const baseDelayMs = options?.baseDelayMs ?? 1000;
    const maxDelayMs = options?.maxDelayMs ?? 10000;
    const scope = options?.scope ?? 'NetworkRetry';
    
    let attempt = 0;
    let lastError: unknown;
    
    while (attempt <= retries) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            
            // Не повторяем для AbortError (отмена запроса пользователем)
            if (isAbortError(e)) {
                throw e;
            }
            
            // Проверяем, стоит ли повторять
            const shouldRetry = attempt < retries && (
                isNetworkError(e) || 
                (e instanceof Response && isRetryableHttpStatus(e.status))
            );
            
            if (!shouldRetry) {
                throw e;
            }
            
            attempt += 1;
            const delay = calculateRetryDelay(attempt - 1, baseDelayMs, maxDelayMs);
            
            logWarn(scope, `Network/retryable error, retrying attempt ${attempt}/${retries}`, {
                error: e instanceof Error ? e.message : String(e),
                delayMs: delay,
                attempt
            });
            
            // Вызываем callback перед повторной попыткой
            options?.onRetry?.(attempt, e);
            
            // Ждем перед повторной попыткой
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    
    // Если все попытки исчерпаны, выбрасываем последнюю ошибку
    logError(scope, `All ${retries} retry attempts failed`, lastError);
    throw lastError;
}

/**
 * Обертка для fetch с автоматическим retry при сетевых ошибках и rate limiting
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryOptions?: {
        retries?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
        scope?: string;
    }
): Promise<Response> {
    const scope = retryOptions?.scope ?? 'FetchWithRetry';
    
    // Проверяем rate limit перед запросом
    if (!checkRateLimit(scope)) {
        const retryAfter = getRetryAfter();
        
        // Если превышен лимит, ждем и повторяем проверку
        if (retryAfter > 0) {
            logWarn(scope, `Rate limit exceeded, waiting ${retryAfter}ms before retry`);
            await new Promise((resolve) => setTimeout(resolve, retryAfter));
            
            // Проверяем еще раз после ожидания
            if (!checkRateLimit(scope)) {
                const error = new Error(`Rate limit exceeded. Please wait ${Math.ceil(getRetryAfter() / 1000)} seconds before making another request.`);
                error.name = 'RateLimitError';
                throw error;
            }
        } else {
            const error = new Error('Rate limit exceeded. Please wait before making another request.');
            error.name = 'RateLimitError';
            throw error;
        }
    }
    
    // Регистрируем запрос
    recordRequest();
    
    return withNetworkRetry(
        async () => {
            const response = await fetch(url, options);
            
            // Если это временная ошибка сервера, выбрасываем для retry
            if (!response.ok && isRetryableHttpStatus(response.status)) {
                throw response;
            }
            
            return response;
        },
        {
            ...retryOptions,
            scope
        }
    );
}

