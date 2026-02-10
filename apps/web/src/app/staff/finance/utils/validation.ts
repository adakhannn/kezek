/**
 * Утилиты валидации для данных смены (ShiftItem)
 */

import type { ShiftItem } from '../types';
import { validateName, validatePositiveNumber } from '@/lib/validation';

export interface ShiftItemValidationResult {
    valid: boolean;
    errors: {
        clientName?: string;
        serviceName?: string;
        serviceAmount?: string;
        consumablesAmount?: string;
    };
}

/**
 * Валидирует один ShiftItem
 */
export function validateShiftItem(item: ShiftItem): ShiftItemValidationResult {
    const errors: ShiftItemValidationResult['errors'] = {};
    
    // Валидация имени клиента
    // Имя клиента обязательно, если нет bookingId
    if (!item.bookingId) {
        const nameValidation = validateName(item.clientName || '', true);
        if (!nameValidation.valid) {
            errors.clientName = nameValidation.error || 'Имя клиента обязательно';
        } else {
            // Дополнительная проверка: имя не должно быть пустым
            const trimmed = (item.clientName || '').trim();
            if (trimmed.length === 0) {
                errors.clientName = 'Имя клиента обязательно';
            } else if (trimmed.length > 200) {
                errors.clientName = 'Имя клиента слишком длинное (максимум 200 символов)';
            }
        }
    }
    
    // Валидация названия услуги (опционально, но если указано, должно быть валидным)
    if (item.serviceName && item.serviceName.trim()) {
        const trimmed = item.serviceName.trim();
        if (trimmed.length > 200) {
            errors.serviceName = 'Название услуги слишком длинное (максимум 200 символов)';
        }
    }
    
    // Валидация суммы услуги (должна быть неотрицательной)
    const serviceAmountValidation = validatePositiveNumber(item.serviceAmount, {
        min: 0,
        allowZero: true,
        required: false,
    });
    if (!serviceAmountValidation.valid) {
        errors.serviceAmount = serviceAmountValidation.error || 'Сумма услуги должна быть неотрицательным числом';
    } else {
        // Дополнительная проверка: максимальное значение (защита от переполнения)
        const amount = Number(item.serviceAmount) || 0;
        if (amount > 100000000) { // 100 миллионов
            errors.serviceAmount = 'Сумма услуги слишком большая (максимум 100,000,000)';
        }
    }
    
    // Валидация суммы расходников (должна быть неотрицательной)
    const consumablesAmountValidation = validatePositiveNumber(item.consumablesAmount, {
        min: 0,
        allowZero: true,
        required: false,
    });
    if (!consumablesAmountValidation.valid) {
        errors.consumablesAmount = consumablesAmountValidation.error || 'Сумма расходников должна быть неотрицательным числом';
    } else {
        // Дополнительная проверка: максимальное значение
        const amount = Number(item.consumablesAmount) || 0;
        if (amount > 100000000) { // 100 миллионов
            errors.consumablesAmount = 'Сумма расходников слишком большая (максимум 100,000,000)';
        }
    }
    
    // Проверка: хотя бы одно поле должно быть заполнено (кроме bookingId)
    // Это проверка для новых items без id
    if (!item.id) {
        const hasData = 
            (item.serviceAmount && Number(item.serviceAmount) > 0) ||
            (item.consumablesAmount && Number(item.consumablesAmount) > 0) ||
            (item.serviceName && item.serviceName.trim().length > 0) ||
            (item.clientName && item.clientName.trim().length > 0 && !item.bookingId);
        
        // Если нет данных и нет bookingId, это ошибка
        if (!hasData && !item.bookingId) {
            if (!errors.clientName) {
                errors.clientName = 'Заполните хотя бы одно поле';
            }
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
 * Получает общее сообщение об ошибке валидации
 */
export function getValidationErrorMessage(
    validation: ShiftItemValidationResult,
    t?: (key: string, fallback?: string) => string
): string | null {
    const errors = Object.values(validation.errors).filter(Boolean);
    if (errors.length === 0) {
        return null;
    }
    
    const translate = t || ((key: string, fallback?: string) => fallback || key);
    
    // Возвращаем первую ошибку или общее сообщение
    if (errors.length === 1) {
        return errors[0];
    }
    
    return translate(
        'staff.finance.validation.multipleErrors',
        `Обнаружены ошибки: ${errors.join(', ')}`
    );
}

