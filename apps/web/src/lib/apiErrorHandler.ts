import { NextResponse } from 'next/server';

import { serverCommonRu } from '@/app/_components/i18n/dictionaries/serverCommon.ru';
import { BizAccessError, StaffSelectionRequiredError } from '@/lib/authDiagnostics';
import { logError, logWarn } from '@/lib/log';
import { isServerMessage, localizeApiResponse } from '@/lib/serverMessages';

/**
 * Generic messages for a failed database or Supabase call (ENG-47). They are server dictionary
 * values, so withErrorHandler / withLocalizedMessages answer them in ru, ky or en.
 */
export const DATABASE_FAILURE_MESSAGES = {
    internal: serverCommonRu['server.common.internalError'],
    load: serverCommonRu['server.common.loadFailed'],
    save: serverCommonRu['server.common.saveFailed'],
    delete: serverCommonRu['server.common.deleteFailed'],
} as const;

type DatabaseErrorShape = { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };

/**
 * A PostgREST / Postgres / Supabase error object: a string `code` together with `details` or `hint`
 * (PostgrestError), or a Supabase Auth / Storage error (`__isAuthError`, `__isStorageError`).
 */
export function isDatabaseError(error: unknown): error is DatabaseErrorShape {
    if (!error || typeof error !== 'object') return false;
    const value = error as DatabaseErrorShape & { __isAuthError?: unknown; __isStorageError?: unknown };
    if (value.__isAuthError === true || value.__isStorageError === true) return true;
    return typeof value.code === 'string' && ('details' in value || 'hint' in value);
}

/** The parts of a database error worth a log line. They stay on the server. */
export function databaseErrorLogData(error: unknown): Record<string, unknown> {
    if (!error || typeof error !== 'object') return { error: error === undefined ? undefined : String(error) };
    const { code, message, details, hint } = error as DatabaseErrorShape;
    return { code, message, details, hint };
}

/**
 * The client-facing message for a failed database or Supabase call (ENG-47). The raw message,
 * details and hint never go into a response: callers log them (reportDatabaseError does). Without
 * a `fallback`, a well-known Postgres code gets its message («Конфликт данных» for 23505, ...);
 * otherwise the fallback, by default «Внутренняя ошибка сервера».
 */
export function databaseErrorMessage(error: unknown, fallback?: string): string {
    if (fallback) return fallback;
    const code = error && typeof error === 'object' ? (error as DatabaseErrorShape).code : undefined;
    const known = typeof code === 'string' ? DATABASE_ERRORS[code] : undefined;
    return known ? known[1] : DATABASE_FAILURE_MESSAGES.internal;
}

/**
 * Logs the raw database error under `scope` (a Sentry issue via logError) and returns the message a
 * client may see (databaseErrorMessage). For a service that turns a failed query into a response.
 */
export function reportDatabaseError(
    scope: string,
    error: unknown,
    fallback?: string,
    context?: Record<string, unknown>,
): string {
    report(() => logError(scope, 'Database error', { ...context, ...databaseErrorLogData(error) }));
    return databaseErrorMessage(error, fallback);
}

/**
 * An Error to throw for a failed database call: its message is safe for a client, the raw error is
 * its `cause`, which the logger of the catching code prints (ENG-47).
 */
export function databaseFailure(error: unknown, message: string = DATABASE_FAILURE_MESSAGES.internal): Error {
    return new Error(message, { cause: error });
}

/**
 * The message of a caught exception when it was written for people (a server dictionary message or
 * Russian text thrown by our own code) or is a machine code (UNAUTHORIZED, NO_BIZ_ACCESS), else
 * `fallback`. Raw database, network and library text (English prose, or any database error object)
 * never reaches the client this way (ENG-47).
 */
export function publicErrorMessage(error: unknown, fallback: string): string {
    if (isDatabaseError(error)) return fallback;
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    if (message && (isServerMessage(message) || CYRILLIC.test(message) || MACHINE_CODE.test(message))) return message;
    return fallback;
}

const CYRILLIC = /[А-Яа-яЁё]/;
/** UNAUTHORIZED, NO_BIZ_ACCESS, APPLICATION_POLICY:blocked: a code clients may match, not prose. */
const MACHINE_CODE = /^[A-Z][A-Z0-9_]*(:[a-z0-9_]+)?$/;

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
 * Создаёт стандартизированный JSON-ответ об ошибке для API routes.
 *
 * @param error - Код типа ошибки (auth, validation, not_found и т.д.)
 * @param message - Человекочитаемое сообщение (опционально)
 * @param details - Дополнительные данные для отладки (опционально)
 * @param status - HTTP статус (по умолчанию 500)
 * @returns NextResponse с телом { ok: false, error, message?, details? }
 */
export function createErrorResponse(
    error: ApiErrorType,
    message?: string,
    details?: unknown,
    status: number = 500
): NextResponse<ApiErrorResponse> {
    const response = buildErrorResponse(error, message, details, status);
    // A 5xx answer always leaves a trace (ARCH-04); 4xx answers are the client's business.
    if (status >= 500) {
        report(() => logError('ApiErrorResponse', `HTTP ${status} ${error}`, { status, error, message, details }, serverErrorMeta(status)));
        reportedResponses.add(response);
    }
    return response;
}

/**
 * 503 for a feature that is switched off on this deployment. It is an expected answer (clients fall
 * back to the old path, e.g. the mobile schedule while the explicit model is off), so it is not
 * reported as a server error.
 */
export function featureDisabledResponse(message: string): NextResponse<ApiErrorResponse> {
    const response = buildErrorResponse('service_unavailable', message, undefined, 503);
    reportedResponses.add(response);
    return response;
}

function buildErrorResponse(
    error: ApiErrorType,
    message: string | undefined,
    details: unknown,
    status: number,
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

// Responses already reported, so that withErrorHandler does not report them a second time.
const reportedResponses = new WeakSet<object>();

function serverErrorMeta(status: number) {
    return { kind: 'api_response' as const, tags: { 'http.status_code': String(status) } };
}

/** Reporting never changes a response: a failing logger, sink or test mock is ignored. */
function report(write: () => void) {
    try {
        write();
    } catch {
        // The answer to the client matters more than its log line.
    }
}

/**
 * Ответ на отказ в кабинете сотрудника (ARCH-02): какой карточкой сотрудника действует запрос.
 * NO_STAFF_RECORD и NO_STAFF_ACCESS — 403; STAFF_SELECTION_REQUIRED — 400 со списком карточек
 * вызывающего (именно 400: mobile откладывает каждый 409 на ручной разбор). Иначе null.
 */
export function staffAccessErrorResponse(error: unknown): NextResponse<ApiErrorResponse> | null {
    if (error instanceof StaffSelectionRequiredError) {
        return createErrorResponse(
            'validation',
            'Выберите бизнес в кабинете сотрудника',
            {
                code: 'STAFF_SELECTION_REQUIRED',
                options: error.staffOptions.map(({ staffId, bizId }) => ({ staffId, bizId })),
            },
            400,
        );
    }
    if (error instanceof BizAccessError && (error.code === 'NO_STAFF_RECORD' || error.code === 'NO_STAFF_ACCESS')) {
        return createErrorResponse('forbidden', 'Нет доступа к кабинету сотрудника', { code: error.code }, 403);
    }
    return null;
}

/**
 * Обрабатывает ошибку и возвращает стандартизированный ответ.
 * По тексту сообщения или структуре ошибки определяет тип (auth, forbidden, validation, not_found, conflict) и HTTP статус.
 *
 * @param error - Пойманная ошибка (Error, NextResponse или объект с полями error/message)
 * @param scope - Имя области для логирования (например, 'QuickHold')
 * @param defaultMessage - Сообщение по умолчанию, если из error не удаётся извлечь текст
 * @returns NextResponse с ApiErrorResponse и соответствующим status
 */
export function handleApiError(
    error: unknown,
    scope: string,
    defaultMessage?: string
): NextResponse<ApiErrorResponse> {
    // Отказ в кабинете сотрудника — штатный ответ, а не ошибка сервера.
    const staffAccess = staffAccessErrorResponse(error);
    if (staffAccess) return staffAccess;

    // Если это уже NextResponse с ошибкой, возвращаем как есть
    if (error instanceof NextResponse) {
        if (error.status >= 500 && !reportedResponses.has(error)) {
            report(() => logError(scope, 'API error', { status: error.status }, serverErrorMeta(error.status)));
            reportedResponses.add(error);
        }
        return error;
    }

    const response = classifyApiError(error, defaultMessage);
    // 5xx: the cause goes to the log and monitoring once. 4xx: a server-side line only (it shows
    // when the text-based classification turns a server failure into a client error).
    if (response.status >= 500) {
        report(() => logError(scope, 'API error', { error, status: response.status }, { tags: { 'http.status_code': String(response.status) } }));
    } else {
        report(() => logWarn(scope, 'API client error', { status: response.status, error: error instanceof Error ? error.message : undefined }));
    }
    reportedResponses.add(response);
    return response;
}

// Database errors with a clear meaning (ARCH-05). Their text is not shown to the client.
const DATABASE_ERRORS: Record<string, [ApiErrorType, string, number]> = {
    '42501': ['forbidden', 'Доступ запрещен', 403],
    '23505': ['conflict', 'Конфликт данных', 409],
    '23503': ['conflict', 'Конфликт данных', 409],
    '23502': ['validation', 'Ошибка валидации', 400],
    '23514': ['validation', 'Ошибка валидации', 400],
    '22P02': ['validation', 'Ошибка валидации', 400],
    PGRST301: ['auth', 'Не авторизован', 401],
};

/**
 * Typed errors first (ARCH-05): access errors by their code and well-known database codes. Only
 * what neither covers falls back to the legacy classification by message text, which used to send
 * NO_BIZ_ACCESS to 500 and AUTH_SERVICE_UNAVAILABLE to 401.
 */
function classifyTypedError(error: unknown): NextResponse<ApiErrorResponse> | null {
    if (error instanceof BizAccessError) {
        switch (error.code) {
            case 'NOT_AUTHENTICATED':
                return buildErrorResponse('auth', error.message || 'Не авторизован', undefined, 401);
            case 'SERVICE_UNAVAILABLE':
                return buildErrorResponse('service_unavailable', 'Сервис авторизации временно недоступен. Повторите позже.', { code: error.code }, 503);
            case 'NO_BIZ_ACCESS':
            case 'STAFF_ROLE_MISMATCH':
                return buildErrorResponse('forbidden', 'Нет доступа к этому бизнесу', { code: error.code }, 403);
            default:
                return null;
        }
    }
    if (error && typeof error === 'object') {
        const code = (error as { code?: unknown }).code;
        const known = typeof code === 'string' ? DATABASE_ERRORS[code] : undefined;
        if (known && typeof (error as { message?: unknown }).message === 'string') {
            const [type, message, status] = known;
            return buildErrorResponse(type, message, undefined, status);
        }
    }
    return null;
}

function classifyApiError(error: unknown, defaultMessage?: string): NextResponse<ApiErrorResponse> {
    const typed = classifyTypedError(error);
    if (typed) return typed;


    // Если это Error с известным типом
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        // The status class comes from the text; the text itself reaches the client only when it was
        // written for people or is a machine code (UNAUTHORIZED). Database, network and library text
        // gets the message of its class (ENG-47).
        const text = publicErrorMessage(error, '');

        // Ошибки авторизации
        if (message.includes('auth') || message.includes('unauthorized') || message.includes('не авторизован')) {
            return buildErrorResponse('auth', text || defaultMessage || 'Не авторизован', undefined, 401);
        }

        // Ошибки доступа
        if (message.includes('forbidden') || message.includes('доступ запрещен')) {
            return buildErrorResponse('forbidden', text || defaultMessage || 'Доступ запрещен', undefined, 403);
        }

        // Ошибки валидации
        if (message.includes('validation') || message.includes('invalid') || message.includes('неверный')) {
            return buildErrorResponse('validation', text || defaultMessage || 'Ошибка валидации', undefined, 400);
        }

        // Ошибки "не найдено"
        if (message.includes('not found') || message.includes('не найден')) {
            return buildErrorResponse('not_found', text || defaultMessage || 'Ресурс не найден', undefined, 404);
        }

        // Конфликты
        if (message.includes('conflict') || message.includes('конфликт')) {
            return buildErrorResponse('conflict', text || defaultMessage || 'Конфликт данных', undefined, 409);
        }
    }

    // Если это объект с полями error и message (уже стандартизированный формат)
    if (error && typeof error === 'object' && 'error' in error) {
        const err = error as { error: string; message?: string; details?: unknown };
        const status = 'status' in error && typeof (error as { status?: number }).status === 'number'
            ? (error as { status: number }).status
            : 500;

        return buildErrorResponse(
            err.error,
            err.message || defaultMessage,
            err.details,
            status
        );
    }

    // Общая ошибка: its own text only when it was written for people (ENG-47).
    return buildErrorResponse(
        'internal',
        defaultMessage || publicErrorMessage(error, DATABASE_FAILURE_MESSAGES.internal),
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
        const response = await handler();
        // A handler that answered 5xx without createErrorResponse still leaves a trace (ARCH-04).
        if (response.status >= 500 && !reportedResponses.has(response)) {
            report(() => logError(scope, `HTTP ${response.status} response`, { status: response.status }, serverErrorMeta(response.status)));
            reportedResponses.add(response);
        }
        // The message in the language of the request (FE-10); after the report, which knows this object.
        return await localizeApiResponse(response);
    } catch (error) {
        return localizeApiResponse(handleApiError(error, scope));
    }
}

/**
 * Создаёт стандартизированный успешный JSON-ответ для API routes.
 *
 * @param data - Тело ответа (попадает в поле `data`)
 * @param additionalFields - Дополнительные поля в корне ответа (например, { alertSent: true })
 * @returns NextResponse с телом { ok: true, data?, ...additionalFields }
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

