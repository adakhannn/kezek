import { formatInTimeZone } from 'date-fns-tz';

import type { ShiftItem } from '../types';
import { fetchWithRetry, isNetworkError } from '../utils/networkRetry';

import { TZ } from '@/lib/time';

export type ShiftItemsOperation = 'save' | 'add' | 'delete';

type ShiftItemsRequestConfig = {
    items: ShiftItem[];
    staffId?: string;
    shiftDate?: Date;
    signal?: AbortSignal;
    scope: string;
    retries: number;
    baseDelayMs: number;
    maxDelayMs: number;
};

type ShiftItemsErrorPayload = {
    error?: unknown;
    message?: unknown;
};

const operationMessages: Record<
    ShiftItemsOperation,
    { defaultMessage: string; forbiddenMessage: string }
> = {
    save: {
        defaultMessage: 'Не удалось сохранить изменения',
        forbiddenMessage: 'У вас нет прав для сохранения изменений.',
    },
    add: {
        defaultMessage: 'Не удалось добавить клиента',
        forbiddenMessage: 'У вас нет прав для добавления клиентов.',
    },
    delete: {
        defaultMessage: 'Не удалось удалить клиента',
        forbiddenMessage: 'У вас нет прав для удаления клиентов.',
    },
};

const shiftNotFoundMessage = 'Смена не найдена. Возможно, смена была закрыта или удалена.';
const sessionExpiredMessage = 'Сессия истекла. Пожалуйста, войдите в систему снова.';
const invalidDataMessage = 'Некорректные данные. Проверьте введенную информацию.';
const tooManyRequestsMessage = 'Слишком много запросов. Пожалуйста, подождите немного.';
const serverTemporaryMessage = 'Временная ошибка сервера. Попробуйте снова через несколько секунд.';
const genericServerMessage = 'Ошибка сервера. Попробуйте обновить страницу.';
const unexpectedErrorMessage = 'Произошла неожиданная ошибка. Попробуйте обновить страницу.';
const networkErrorMessage = 'Проблема с подключением к интернету. Проверьте соединение и попробуйте снова.';

export function formatShiftItemsDate(shiftDate?: Date): string | undefined {
    return shiftDate ? formatInTimeZone(shiftDate, TZ, 'yyyy-MM-dd') : undefined;
}

export async function postShiftItemsRequest({
    items,
    staffId,
    shiftDate,
    signal,
    scope,
    retries,
    baseDelayMs,
    maxDelayMs,
}: ShiftItemsRequestConfig): Promise<Response> {
    return fetchWithRetry(
        '/api/staff/shift/items',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items,
                staffId: staffId || undefined,
                shiftDate: formatShiftItemsDate(shiftDate),
            }),
            signal,
        },
        {
            retries,
            baseDelayMs,
            maxDelayMs,
            scope,
        }
    );
}

export async function getShiftItemsResponseErrorMessage(
    response: Response,
    operation: ShiftItemsOperation
): Promise<string> {
    const messages = operationMessages[operation];
    const payloadMessage = await readShiftItemsErrorMessage(response);
    const defaultMessage = payloadMessage || messages.defaultMessage;

    if (response.status === 404) return shiftNotFoundMessage;
    if (response.status === 401) return sessionExpiredMessage;
    if (response.status === 403) return messages.forbiddenMessage;
    if (response.status === 400) return defaultMessage || invalidDataMessage;
    if (response.status === 429) return tooManyRequestsMessage;
    if (response.status >= 500) return serverTemporaryMessage;

    return defaultMessage;
}

export function getShiftItemsJsonErrorMessage(
    json: unknown,
    operation: ShiftItemsOperation
): string {
    const messages = operationMessages[operation];
    if (json && typeof json === 'object') {
        const payload = json as ShiftItemsErrorPayload;
        if (typeof payload.error === 'string' && payload.error) return payload.error;
        if (typeof payload.message === 'string' && payload.message) return payload.message;
    }
    return messages.defaultMessage;
}

export function getShiftItemsThrownErrorMessage(
    error: unknown,
    operation: ShiftItemsOperation
): string {
    const messages = operationMessages[operation];

    if (error instanceof Error && error.name === 'RateLimitError') {
        return error.message || tooManyRequestsMessage;
    }

    if (isNetworkError(error)) {
        return networkErrorMessage;
    }

    if (error instanceof Response) {
        if (error.status >= 500) return serverTemporaryMessage;
        if (error.status === 429) return tooManyRequestsMessage;
        return genericServerMessage;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return messages.defaultMessage || unexpectedErrorMessage;
}

export function shouldRestoreShiftItemsFromError(errorMessage: string): boolean {
    return (
        errorMessage.includes('Нет открытой смены') ||
        errorMessage.includes('закрыта') ||
        errorMessage.includes('не найдена')
    );
}

async function readShiftItemsErrorMessage(response: Response): Promise<string | null> {
    try {
        const payload = (await response.clone().json()) as ShiftItemsErrorPayload;
        if (typeof payload.error === 'string' && payload.error) return payload.error;
        if (typeof payload.message === 'string' && payload.message) return payload.message;
    } catch {
        return null;
    }

    return null;
}
