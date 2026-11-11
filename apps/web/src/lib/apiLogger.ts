// apps/web/src/lib/apiLogger.ts
/**
 * Утилита для логирования всех API запросов в dev режиме
 * Помогает выявить дублирующиеся запросы и лишние вызовы
 */

import { logDebug, logError, logWarn, maskUrl } from './log';

interface ApiCall {
    url: string;
    method: string;
    timestamp: number;
    duration?: number;
    status?: number;
    error?: string;
}

// Хранилище последних запросов (для обнаружения дубликатов)
const recentCalls = new Map<string, ApiCall[]>();

// Группируем запросы по URL и методу для обнаружения дубликатов
function getCallKey(url: string, method: string): string {
    return `${method}:${url}`;
}

/**
 * Логирует API запрос
 */
export function logApiCall(
    url: string,
    method: string,
    options?: {
        duration?: number;
        status?: number;
        error?: string;
        body?: unknown;
    }
) {
    // Работает только в dev режиме
    if (process.env.NODE_ENV !== 'development') {
        return;
    }

    const safeUrl = maskUrl(url);
    const call: ApiCall = {
        url: safeUrl,
        method,
        timestamp: Date.now(),
        duration: options?.duration,
        status: options?.status,
        error: options?.error,
    };

    const key = getCallKey(safeUrl, method);
    const calls = recentCalls.get(key) || [];
    calls.push(call);
    
    // Оставляем только последние 10 запросов для каждого ключа
    if (calls.length > 10) {
        calls.shift();
    }
    recentCalls.set(key, calls);

    // Проверяем на дубликаты (если тот же запрос был менее 1 секунды назад)
    const duplicateCalls = calls.filter(
        (c) => c !== call && Math.abs(c.timestamp - call.timestamp) < 1000
    );

    if (duplicateCalls.length > 0) {
        logWarn('ApiLogger', 'Duplicate API call detected', {
            method,
            url: safeUrl,
            previousCalls: duplicateCalls.length,
            timeSinceLastMs: call.timestamp - duplicateCalls[duplicateCalls.length - 1].timestamp,
        });
    }

    // Логируем запрос
    const logMessage = 'API request completed';
    const logData: Record<string, unknown> = {
        method,
        url: safeUrl,
    };

    if (options?.duration !== undefined) {
        logData.duration = `${options.duration}ms`;
    }
    if (options?.status !== undefined) {
        logData.status = options.status;
    }
    if (options?.error) {
        logData.error = options.error;
    }
    if (options?.body) {
        logData.body = options.body;
    }

    if (options?.error || (options?.status && options.status >= 400)) {
        logError('ApiLogger', logMessage, logData);
    } else if (duplicateCalls.length > 0) {
        logWarn('ApiLogger', logMessage, logData);
    } else {
        logDebug('ApiLogger', logMessage, logData);
    }
}

/**
 * Получает статистику по API вызовам
 */
export function getApiStats(): {
    totalCalls: number;
    duplicateCalls: number;
    callsByUrl: Record<string, number>;
} {
    let totalCalls = 0;
    let duplicateCalls = 0;
    const callsByUrl: Record<string, number> = {};

    recentCalls.forEach((calls, key) => {
        totalCalls += calls.length;
        callsByUrl[key] = calls.length;

        // Подсчитываем дубликаты (запросы в пределах 1 секунды)
        for (let i = 1; i < calls.length; i++) {
            if (Math.abs(calls[i].timestamp - calls[i - 1].timestamp) < 1000) {
                duplicateCalls++;
            }
        }
    });

    return {
        totalCalls,
        duplicateCalls,
        callsByUrl,
    };
}

/**
 * Очищает историю запросов
 */
export function clearApiLogs() {
    recentCalls.clear();
}

