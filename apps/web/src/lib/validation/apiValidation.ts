/**
 * Утилиты для валидации данных в API routes
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createErrorResponse } from '../apiErrorHandler';

/**
 * Результат валидации
 */
export type ValidationResult<T> = 
    | { success: true; data: T }
    | { success: false; response: NextResponse };

/**
 * Валидирует тело запроса по Zod схеме
 * 
 * @param req - Request объект
 * @param schema - Zod схема для валидации
 * @returns Результат валидации с данными или ошибкой
 * 
 * @example
 * ```typescript
 * const result = await validateRequest(req, z.object({
 *   name: z.string().min(1),
 *   email: z.string().email()
 * }));
 * 
 * if (!result.success) {
 *   return result.response; // NextResponse с ошибкой
 * }
 * 
 * const { name, email } = result.data; // Типизированные данные
 * ```
 */
export async function validateRequest<T extends z.ZodTypeAny>(
    req: Request,
    schema: T
): Promise<ValidationResult<z.infer<T>>> {
    try {
        // Парсим JSON
        const body = await req.json();
        
        // Валидируем по схеме
        const data = await schema.parseAsync(body);
        
        return { success: true, data };
    } catch (error) {
        // Обработка ошибок парсинга JSON
        if (error instanceof SyntaxError || (error as Error).name === 'SyntaxError') {
            return {
                success: false,
                response: createErrorResponse(
                    'validation',
                    'Invalid JSON in request body',
                    undefined,
                    400
                ),
            };
        }
        
        // Обработка ошибок валидации Zod
        if (error instanceof z.ZodError) {
            const errors = error.issues.map((err) => ({
                path: err.path.join('.'),
                message: err.message,
            }));
            
            return {
                success: false,
                response: createErrorResponse(
                    'validation',
                    'Validation failed',
                    { errors },
                    400
                ),
            };
        }
        
        // Неизвестная ошибка
        return {
            success: false,
            response: createErrorResponse(
                'validation',
                'Failed to validate request',
                error instanceof Error ? error.message : String(error),
                400
            ),
        };
    }
}

/**
 * Обертка для API route handlers с автоматической валидацией
 * 
 * @param schema - Zod схема для валидации тела запроса
 * @param handler - Функция-обработчик, получающая валидированные данные
 * @returns NextResponse
 * 
 * @example
 * ```typescript
 * export async function POST(req: Request) {
 *   return withValidation(
 *     z.object({
 *       name: z.string().min(1),
 *       email: z.string().email()
 *     }),
 *     async (data) => {
 *       // data типизирован и валидирован
 *       return NextResponse.json({ ok: true, data });
 *     }
 *   );
 * }
 * ```
 */
export function withValidation<T extends z.ZodTypeAny>(
    schema: T,
    handler: (data: z.infer<T>, req: Request) => Promise<NextResponse>
): (req: Request) => Promise<NextResponse> {
    return async (req: Request) => {
        const result = await validateRequest(req, schema);
        
        if (!result.success) {
            return result.response;
        }
        
        return handler(result.data, req);
    };
}

/**
 * Валидирует query параметры из URL
 * 
 * @param url - URL объект
 * @param schema - Zod схема для валидации
 * @returns Результат валидации
 */
export function validateQuery<T extends z.ZodTypeAny>(
    url: URL,
    schema: T
): ValidationResult<z.infer<T>> {
    try {
        // Преобразуем URLSearchParams в объект
        const params: Record<string, string | string[]> = {};
        url.searchParams.forEach((value, key) => {
            if (params[key]) {
                // Если ключ уже есть, делаем массив
                const existing = params[key];
                params[key] = Array.isArray(existing) ? [...existing, value] : [existing as string, value];
            } else {
                params[key] = value;
            }
        });
        
        const data = schema.parse(params);
        
        return { success: true, data };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.issues.map((err) => ({
                path: err.path.join('.'),
                message: err.message,
            }));
            
            return {
                success: false,
                response: createErrorResponse(
                    'validation',
                    'Invalid query parameters',
                    { errors },
                    400
                ),
            };
        }
        
        return {
            success: false,
            response: createErrorResponse(
                'validation',
                'Failed to validate query parameters',
                error instanceof Error ? error.message : String(error),
                400
            ),
        };
    }
}

