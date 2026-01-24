/**
 * Утилиты для мониторинга производительности критичных операций
 */

import { logDebug, logWarn, logError } from './log';

type PerformanceMetric = {
    operation: string;
    duration: number; // в миллисекундах
    timestamp: number;
    success: boolean;
    metadata?: Record<string, unknown>;
};

// In-memory хранилище метрик (для dev/staging)
// В продакшене лучше использовать внешний сервис (Datadog, New Relic, CloudWatch)
const metricsStore: PerformanceMetric[] = [];

// Максимальное количество метрик в памяти (чтобы не переполнить память)
const MAX_METRICS = 1000;

// Пороговые значения для алертов (в миллисекундах)
const PERFORMANCE_THRESHOLDS: Record<string, { warn: number; error: number }> = {
    'get_free_slots_service_day_v2': { warn: 2000, error: 5000 }, // 2s warn, 5s error
    'shift_close': { warn: 3000, error: 10000 }, // 3s warn, 10s error
    'apply_promotion': { warn: 1000, error: 3000 }, // 1s warn, 3s error
    'recalculate_ratings': { warn: 30000, error: 60000 }, // 30s warn, 60s error
};

/**
 * Измеряет время выполнения функции и записывает метрику
 */
export async function measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let error: unknown = null;

    try {
        const result = await fn();
        success = true;
        return result;
    } catch (e) {
        error = e;
        throw e;
    } finally {
        const duration = Date.now() - startTime;
        const metric: PerformanceMetric = {
            operation,
            duration,
            timestamp: startTime,
            success,
            metadata: {
                ...metadata,
                error: error instanceof Error ? error.message : String(error),
            },
        };

        // Записываем метрику
        recordMetric(metric);

        // Проверяем пороговые значения и отправляем алерты
        checkThresholds(metric);
    }
}

/**
 * Записывает метрику в хранилище
 */
function recordMetric(metric: PerformanceMetric) {
    metricsStore.push(metric);

    // Очищаем старые метрики, если превышен лимит
    if (metricsStore.length > MAX_METRICS) {
        // Удаляем самые старые метрики (оставляем последние MAX_METRICS)
        const toRemove = metricsStore.length - MAX_METRICS;
        metricsStore.splice(0, toRemove);
    }

    // Логируем метрику в dev режиме
    logDebug('Performance', `[${metric.operation}] ${metric.duration}ms`, {
        success: metric.success,
        metadata: metric.metadata,
    });
}

/**
 * Проверяет пороговые значения и отправляет алерты
 */
function checkThresholds(metric: PerformanceMetric) {
    const threshold = PERFORMANCE_THRESHOLDS[metric.operation];
    if (!threshold) {
        return; // Нет порогов для этой операции
    }

    const { warn, error: errorThreshold } = threshold;

    if (metric.duration >= errorThreshold) {
        logError('Performance', `[${metric.operation}] CRITICAL: ${metric.duration}ms (threshold: ${errorThreshold}ms)`, {
            duration: metric.duration,
            threshold: errorThreshold,
            metadata: metric.metadata,
        });
        // В продакшене здесь можно отправить алерт в систему мониторинга
        // await sendAlert('performance_critical', { operation: metric.operation, duration: metric.duration });
    } else if (metric.duration >= warn) {
        logWarn('Performance', `[${metric.operation}] WARNING: ${metric.duration}ms (threshold: ${warn}ms)`, {
            duration: metric.duration,
            threshold: warn,
            metadata: metric.metadata,
        });
    }
}

/**
 * Получает статистику по метрикам для указанной операции
 */
export function getPerformanceStats(operation: string, windowMs: number = 5 * 60 * 1000): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
    p99Duration: number;
    errorRate: number;
} {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Фильтруем метрики по операции и временному окну
    const relevantMetrics = metricsStore.filter(
        (m) => m.operation === operation && m.timestamp >= windowStart
    );

    if (relevantMetrics.length === 0) {
        return {
            count: 0,
            avgDuration: 0,
            minDuration: 0,
            maxDuration: 0,
            p95Duration: 0,
            p99Duration: 0,
            errorRate: 0,
        };
    }

    // Сортируем по длительности
    const durations = relevantMetrics.map((m) => m.duration).sort((a, b) => a - b);
    const errors = relevantMetrics.filter((m) => !m.success).length;

    const sum = durations.reduce((acc, d) => acc + d, 0);
    const avgDuration = sum / durations.length;
    const minDuration = durations[0];
    const maxDuration = durations[durations.length - 1];
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    const p95Duration = durations[p95Index] || 0;
    const p99Duration = durations[p99Index] || 0;
    const errorRate = errors / relevantMetrics.length;

    return {
        count: relevantMetrics.length,
        avgDuration: Math.round(avgDuration),
        minDuration,
        maxDuration,
        p95Duration,
        p99Duration,
        errorRate: Math.round(errorRate * 100) / 100,
    };
}

/**
 * Получает все метрики для указанной операции
 */
export function getMetrics(operation: string, limit: number = 100): PerformanceMetric[] {
    return metricsStore
        .filter((m) => m.operation === operation)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
}

/**
 * Очищает все метрики
 */
export function clearMetrics(): void {
    metricsStore.length = 0;
}

/**
 * Получает список всех операций с метриками
 */
export function getOperations(): string[] {
    const operations = new Set<string>();
    for (const metric of metricsStore) {
        operations.add(metric.operation);
    }
    return Array.from(operations);
}

