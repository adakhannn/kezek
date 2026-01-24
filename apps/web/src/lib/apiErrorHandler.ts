import { NextResponse } from 'next/server';

import { logError } from '@/lib/log';

/**
 * Стандартный формат ответа об ошибке для API routes
 */
export type ApiErrorResponse = {
    ok: false;
    error: string;
    message?: string;
    details?: unknown;
};

/**
 * Стандартный формат успешного ответа для API routes
 */
export type ApiSuccessResponse<T = unknown> = {
    ok: true;
    data?: T;
    [key: string]: unknown; // Позволяет добавлять дополнительные поля
};

/**
 * Типы ошибок для стандартизации
 */
export type ApiErrorType =
    | 'auth' // Ошибка авторизации (401)
    | 'forbidden' // Доступ запрещен (403)
    | 'not_found' // Ресурс не найден (404)
    | 'validation' // Ошибка валидации (400)
    | 'conflict' // Конфликт данных (409)
    | 'rate_limit' // Превышен лимит запросов (429)
    | 'internal' // Внутренняя ошибка сервера (500)
    | 'service_unavailable' // Сервис недоступен (503)
    | string; // Кастомные типы ошибок

/**
 * Создает стандартизированный ответ об ошибке
 */
export function createErrorResponse(
    error: ApiErrorType,
    message?: string,
    details?: unknown,
    status: number = 500
): NextResponse<ApiErrorResponse> {
    const response: ApiErrorResponse = {
        ok: false,
        error,
    };

    if (message) {
        response.message = message;
    }

    if (details !== undefined) {
        response.details = details;
    }

    return NextResponse.json(response, { status });
}

/**
 * Обрабатывает ошибку и возвращает стандартизированный ответ
 * Автоматически определяет тип ошибки и HTTP статус
 */
export function handleApiError(
    error: unknown,
    scope: string,
    defaultMessage?: string
): NextResponse<ApiErrorResponse> {
    // Логируем ошибку
    logError(scope, 'API error', error);

    // Если это уже NextResponse с ошибкой, возвращаем как есть
    if (error instanceof NextResponse) {
        return error;
    }

    // Если это Error с известным типом
    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Ошибки авторизации
        if (message.includes('auth') || message.includes('unauthorized') || message.includes('не авторизован')) {
            return createErrorResponse('auth', error.message || defaultMessage || 'Не авторизован', undefined, 401);
        }

        // Ошибки доступа
        if (message.includes('forbidden') || message.includes('доступ запрещен')) {
            return createErrorResponse('forbidden', error.message || defaultMessage || 'Доступ запрещен', undefined, 403);
        }

        // Ошибки валидации
        if (message.includes('validation') || message.includes('invalid') || message.includes('неверный')) {
            return createErrorResponse('validation', error.message || defaultMessage || 'Ошибка валидации', undefined, 400);
        }

        // Ошибки "не найдено"
        if (message.includes('not found') || message.includes('не найден')) {
            return createErrorResponse('not_found', error.message || defaultMessage || 'Ресурс не найден', undefined, 404);
        }

        // Конфликты
        if (message.includes('conflict') || message.includes('конфликт')) {
            return createErrorResponse('conflict', error.message || defaultMessage || 'Конфликт данных', undefined, 409);
        }
    }

    // Если это объект с полями error и message (уже стандартизированный формат)
    if (error && typeof error === 'object' && 'error' in error) {
        const err = error as { error: string; message?: string; details?: unknown };
        const status = 'status' in error && typeof (error as { status?: number }).status === 'number'
            ? (error as { status: number }).status
            : 500;

        return createErrorResponse(
            err.error,
            err.message || defaultMessage,
            err.details,
            status
        );
    }

    // Общая ошибка
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResponse(
        'internal',
        defaultMessage || message || 'Внутренняя ошибка сервера',
        process.env.NODE_ENV === 'development' ? error : undefined,
        500
    );
}

/**
 * Обертка для API route handlers с автоматической обработкой ошибок
 * 
 * @example
 * export async function GET(req: Request) {
 *   return withErrorHandler('MyApi', async () => {
 *     // ваш код
 *     return NextResponse.json({ ok: true, data: result });
 *   });
 * }
 */
export async function withErrorHandler<T>(
    scope: string,
    handler: () => Promise<NextResponse<T | ApiErrorResponse>>
): Promise<NextResponse<T | ApiErrorResponse>> {
    try {
        return await handler();
    } catch (error) {
        return handleApiError(error, scope);
    }
}

/**
 * Создает успешный ответ
 */
export function createSuccessResponse<T = unknown>(
    data?: T,
    additionalFields?: Record<string, unknown>
): NextResponse<ApiSuccessResponse<T>> {
    const response: ApiSuccessResponse<T> = {
        ok: true,
        ...additionalFields,
    };

    if (data !== undefined) {
        response.data = data;
    }

    return NextResponse.json(response);
}

