/**
 * Утилиты для логирования метрик API запросов
 * Автоматически отслеживает время ответа и статусы для анализа производительности
 */

import { logWarn } from './log';
import { getServiceClient } from './supabaseService';

import type { Json } from '@/types/supabase';

export interface ApiMetricOptions {
    endpoint: string;
    method: string;
    statusCode: number;
    durationMs: number;
    userId?: string;
    staffId?: string;
    bizId?: string;
    errorMessage?: string;
    errorType?: 'validation' | 'database' | 'auth' | 'server' | 'network';
    requestSizeBytes?: number;
    responseSizeBytes?: number;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Логирует метрику API запроса в базу данных
 * Выполняется асинхронно, не блокирует ответ
 */
export async function logApiMetric(options: ApiMetricOptions): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    try {
        const supabase = getServiceClient();
        
        // Вызываем функцию БД для записи метрики
        const { error } = await supabase.rpc('log_api_metric', {
            p_endpoint: options.endpoint,
            p_method: options.method,
            p_status_code: options.statusCode,
            p_duration_ms: options.durationMs,
            p_user_id: options.userId || undefined,
            p_staff_id: options.staffId || undefined,
            p_biz_id: options.bizId || undefined,
            p_error_message: options.errorMessage || undefined,
            p_error_type: options.errorType || undefined,
            p_request_size_bytes: options.requestSizeBytes || undefined,
            p_response_size_bytes: options.responseSizeBytes || undefined,
            p_metadata: (options.metadata as Json | undefined) || undefined,
            p_ip_address: options.ipAddress || undefined,
            p_user_agent: options.userAgent || undefined,
        });
        
        if (error) {
            // Логируем ошибку, но не прерываем выполнение
            logWarn('ApiMetrics', 'Failed to record API metric', error);
        }
    } catch (error) {
        // Игнорируем ошибки логирования метрик, чтобы не влиять на основной поток
        logWarn('ApiMetrics', 'Error recording API metric', error);
    }
}

/**
 * Определяет тип ошибки на основе статус кода и сообщения
 */
export function determineErrorType(
    statusCode: number,
    errorMessage?: string
): 'validation' | 'database' | 'auth' | 'server' | 'network' | null {
    if (statusCode < 400) {
        return null;
    }
    
    // 4xx ошибки
    if (statusCode >= 400 && statusCode < 500) {
        if (statusCode === 401 || statusCode === 403) {
            return 'auth';
        }
        if (statusCode === 400 || statusCode === 422) {
            return 'validation';
        }
        return 'server';
    }
    
    // 5xx ошибки
    if (statusCode >= 500) {
        const msg = (errorMessage || '').toLowerCase();
        if (msg.includes('database') || msg.includes('sql') || msg.includes('query')) {
            return 'database';
        }
        if (msg.includes('network') || msg.includes('timeout') || msg.includes('connection')) {
            return 'network';
        }
        return 'server';
    }
    
    return null;
}

/**
 * Получает IP адрес из Request
 */
export function getIpAddress(req: Request): string | undefined {
    // Пробуем получить из заголовков (для прокси)
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    
    const realIp = req.headers.get('x-real-ip');
    if (realIp) {
        return realIp;
    }
    
    return undefined;
}

/**
 * Wrapper для API route handlers с автоматическим логированием метрик
 */
export function withApiMetrics<T>(
    handler: (req: Request, context?: T) => Promise<Response>,
    endpoint: string
) {
    return async (req: Request, context?: T): Promise<Response> => {
        const startTime = Date.now();
        const method = req.method;
        let statusCode = 500;
        let errorMessage: string | undefined;
        let responseSizeBytes: number | undefined;
        
        try {
            // Выполняем handler
            const response = await handler(req, context);
            
            // Получаем статус код
            statusCode = response.status;
            
            // Пытаемся получить размер ответа (если доступно)
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
                responseSizeBytes = parseInt(contentLength, 10);
            }
            
            // Логируем метрику асинхронно (не блокируем ответ)
            logApiMetric({
                endpoint,
                method,
                statusCode,
                durationMs: Date.now() - startTime,
                errorType: determineErrorType(statusCode) || undefined,
                responseSizeBytes,
                ipAddress: getIpAddress(req),
                userAgent: req.headers.get('user-agent') || undefined,
            }).catch(() => {
                // Игнорируем ошибки логирования
            });
            
            return response;
        } catch (error) {
            // Определяем статус код для ошибки
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            
            // Логируем метрику с ошибкой
            logApiMetric({
                endpoint,
                method,
                statusCode,
                durationMs: Date.now() - startTime,
                errorMessage,
                errorType: determineErrorType(statusCode, errorMessage) || undefined,
                ipAddress: getIpAddress(req),
                userAgent: req.headers.get('user-agent') || undefined,
            }).catch(() => {
                // Игнорируем ошибки логирования
            });
            
            // Пробрасываем ошибку дальше
            throw error;
        }
    };
}

