/**
 * Утилиты валидации для данных смены (ShiftItem).
 * Возвращают i18n-ключи (staff.finance.validation.*); текст подставляется в UI через t().
 */

import type { ShiftItem } from '../types';

import { validateName, validatePositiveNumber } from '@/lib/validation';

/** i18n-ключи для сообщений валидации (staff.finance.validation.*) */
export const VALIDATION_KEYS = {
    clientNameRequired: 'staff.finance.validation.clientNameRequired',
    clientNameTooLong: 'staff.finance.validation.clientNameTooLong',
    serviceRequired: 'staff.finance.validation.serviceRequired',
    serviceNameTooLong: 'staff.finance.validation.serviceNameTooLong',
    serviceAmountRequired: 'staff.finance.validation.serviceAmountRequired',
    serviceAmountInvalid: 'staff.finance.validation.serviceAmountInvalid',
    serviceAmountTooLarge: 'staff.finance.validation.serviceAmountTooLarge',
    consumablesAmountInvalid: 'staff.finance.validation.consumablesAmountInvalid',
    consumablesAmountTooLarge: 'staff.finance.validation.consumablesAmountTooLarge',
    fillAtLeastOneField: 'staff.finance.validation.fillAtLeastOneField',
    multipleErrors: 'staff.finance.validation.multipleErrors',
} as const;

export interface ShiftItemValidationResult {
    valid: boolean;
    /** Значения — i18n-ключи (staff.finance.validation.*); в UI использовать t(errors.xxx). */
    errors: {
        clientName?: string;
        serviceName?: string;
        serviceAmount?: string;
        consumablesAmount?: string;
    };
}

/**
 * Валидирует один ShiftItem. Возвращает ошибки в виде i18n-ключей.
 */
export function validateShiftItem(item: ShiftItem): ShiftItemValidationResult {
    const errors: ShiftItemValidationResult['errors'] = {};
    const K = VALIDATION_KEYS;

    // Валидация имени клиента (обязательно, если нет bookingId)
    if (!item.bookingId) {
        const nameValidation = validateName(item.clientName || '', true);
        if (!nameValidation.valid) {
            errors.clientName = K.clientNameRequired;
        } else {
            const trimmed = (item.clientName || '').trim();
            if (trimmed.length === 0) {
                errors.clientName = K.clientNameRequired;
            } else if (trimmed.length > 200) {
                errors.clientName = K.clientNameTooLong;
            }
        }
    }

    // Услуга обязательна: должно быть выбрано название услуги
    const serviceNameTrimmed = (item.serviceName || '').trim();
    if (serviceNameTrimmed.length === 0) {
        errors.serviceName = K.serviceRequired;
    } else if (serviceNameTrimmed.length > 200) {
        errors.serviceName = K.serviceNameTooLong;
    }

    // Сумма услуги обязательна и должна быть больше 0
    const serviceAmountNum = Number(item.serviceAmount);
    const amountIsEmpty = item.serviceAmount === undefined || item.serviceAmount === null;
    const amountIsZero = !amountIsEmpty && !Number.isNaN(serviceAmountNum) && serviceAmountNum === 0;
    if (amountIsEmpty || Number.isNaN(serviceAmountNum) || amountIsZero) {
        errors.serviceAmount = K.serviceAmountRequired;
    } else {
        const serviceAmountValidation = validatePositiveNumber(item.serviceAmount, { min: 0, allowZero: false, required: true });
        if (!serviceAmountValidation.valid) {
            errors.serviceAmount = K.serviceAmountInvalid;
        } else if (serviceAmountNum > 100000000) {
            errors.serviceAmount = K.serviceAmountTooLarge;
        }
    }

    // Валидация суммы расходников
    const consumablesAmountValidation = validatePositiveNumber(item.consumablesAmount, {
        min: 0,
        allowZero: true,
        required: false,
    });
    if (!consumablesAmountValidation.valid) {
        errors.consumablesAmount = K.consumablesAmountInvalid;
    } else {
        const amount = Number(item.consumablesAmount) || 0;
        if (amount > 100000000) {
            errors.consumablesAmount = K.consumablesAmountTooLarge;
        }
    }

    // Хотя бы одно поле должно быть заполнено для нового item без bookingId
    if (!item.id) {
        const hasData =
            (item.serviceAmount && Number(item.serviceAmount) > 0) ||
            (item.consumablesAmount && Number(item.consumablesAmount) > 0) ||
            (item.serviceName && item.serviceName.trim().length > 0) ||
            (item.clientName && item.clientName.trim().length > 0 && !item.bookingId);
        if (!hasData && !item.bookingId && !errors.clientName) {
            errors.clientName = K.fillAtLeastOneField;
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    };
}

/**
 * Валидирует массив ShiftItem
 */
export function validateShiftItems(items: ShiftItem[]): {
    valid: boolean;
    errors: Array<{ index: number; errors: ShiftItemValidationResult['errors'] }>;
} {
    const errors: Array<{ index: number; errors: ShiftItemValidationResult['errors'] }> = [];
    
    items.forEach((item, index) => {
        const validation = validateShiftItem(item);
        if (!validation.valid) {
            errors.push({
                index,
                errors: validation.errors,
            });
        }
    });
    
    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Возвращает общее сообщение об ошибке валидации (уже переведённое, если передана t).
 * errors содержат i18n-ключи; при одной ошибке возвращается перевод первой, иначе — multipleErrors.
 */
export function getValidationErrorMessage(
    validation: ShiftItemValidationResult,
    t?: (key: string, fallback?: string) => string
): string | null {
    const errorKeys = Object.values(validation.errors).filter(Boolean);
    if (errorKeys.length === 0) {
        return null;
    }
    const translate = t || ((key: string) => key);
    if (errorKeys.length === 1) {
        return translate(errorKeys[0]);
    }
    return translate(VALIDATION_KEYS.multipleErrors);
}

