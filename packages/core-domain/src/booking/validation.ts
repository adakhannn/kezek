/**
 * Валидация данных для бронирований и промоакций
 */

import type { CreateBookingParams, CreateGuestBookingParams, PromotionType, PromotionParams } from './types';

/**
 * Валидирует параметры создания бронирования
 */
export function validateCreateBookingParams(params: unknown): {
    valid: boolean;
    error?: string;
    data?: CreateBookingParams;
} {
    if (!params || typeof params !== 'object') {
        return { valid: false, error: 'Параметры должны быть объектом' };
    }

    const p = params as Record<string, unknown>;

    // Проверка обязательных полей
    if (typeof p.biz_id !== 'string' || !p.biz_id.trim()) {
        return { valid: false, error: 'biz_id обязателен и должен быть строкой' };
    }

    if (typeof p.service_id !== 'string' || !p.service_id.trim()) {
        return { valid: false, error: 'service_id обязателен и должен быть строкой' };
    }

    if (typeof p.staff_id !== 'string' || !p.staff_id.trim()) {
        return { valid: false, error: 'staff_id обязателен и должен быть строкой' };
    }

    if (typeof p.start_at !== 'string' || !p.start_at.trim()) {
        return { valid: false, error: 'start_at обязателен и должен быть ISO-строкой' };
    }

    // Валидация ISO-даты
    const startAtDate = new Date(p.start_at);
    if (isNaN(startAtDate.getTime())) {
        return { valid: false, error: 'start_at должен быть валидной ISO-датой' };
    }

    // branch_id опционален
    const branch_id = p.branch_id !== undefined && p.branch_id !== null 
        ? (typeof p.branch_id === 'string' ? p.branch_id : null)
        : null;

    return {
        valid: true,
        data: {
            biz_id: p.biz_id.trim(),
            branch_id,
            service_id: p.service_id.trim(),
            staff_id: p.staff_id.trim(),
            start_at: p.start_at.trim(),
        },
    };
}

/**
 * Валидирует параметры создания гостевой брони
 */
export function validateCreateGuestBookingParams(params: unknown): {
    valid: boolean;
    error?: string;
    data?: CreateGuestBookingParams;
} {
    if (!params || typeof params !== 'object') {
        return { valid: false, error: 'Параметры должны быть объектом' };
    }

    const p = params as Record<string, unknown>;

    // Проверка обязательных полей (наследуем от CreateBookingParams)
    const bookingValidation = validateCreateBookingParams({
        biz_id: p.biz_id,
        branch_id: p.branch_id,
        service_id: p.service_id,
        staff_id: p.staff_id,
        start_at: p.start_at,
    });

    if (!bookingValidation.valid || !bookingValidation.data) {
        return { valid: false, error: bookingValidation.error };
    }

    // Дополнительные проверки для гостевой брони
    if (typeof p.branch_id !== 'string' || !p.branch_id.trim()) {
        return { valid: false, error: 'branch_id обязателен для гостевой брони' };
    }

    if (typeof p.client_name !== 'string' || !p.client_name.trim()) {
        return { valid: false, error: 'client_name обязателен и должен быть строкой' };
    }

    if (typeof p.client_phone !== 'string' || !p.client_phone.trim()) {
        return { valid: false, error: 'client_phone обязателен и должен быть строкой' };
    }

    // Нормализация телефона (убираем пробелы, дефисы)
    const normalizedPhone = p.client_phone.replace(/\s+/g, '').replace(/[-\s()]/g, '');

    // client_email опционален
    const client_email = p.client_email !== undefined && p.client_email !== null
        ? (typeof p.client_email === 'string' ? p.client_email.trim() || null : null)
        : null;

    // Валидация email, если указан
    if (client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
        return { valid: false, error: 'client_email должен быть валидным email-адресом' };
    }

    return {
        valid: true,
        data: {
            ...bookingValidation.data,
            branch_id: p.branch_id.trim(),
            client_name: p.client_name.trim(),
            client_phone: normalizedPhone,
            client_email,
        },
    };
}

/**
 * Валидирует параметры промоакции в зависимости от типа
 */
export function validatePromotionParams(
    promotionType: PromotionType,
    params: unknown
): {
    valid: boolean;
    error?: string;
    data?: PromotionParams;
} {
    if (!params || typeof params !== 'object') {
        return { valid: false, error: 'Параметры промоакции должны быть объектом' };
    }

    const p = params as Record<string, unknown>;

    switch (promotionType) {
        case 'free_after_n_visits':
            if (typeof p.visit_count !== 'number' || p.visit_count <= 0) {
                return { valid: false, error: 'visit_count должен быть положительным числом' };
            }
            return { valid: true, data: { visit_count: p.visit_count } };

        case 'birthday_discount':
        case 'first_visit_discount':
        case 'referral_discount_50':
            if (typeof p.discount_percent !== 'number' || p.discount_percent < 0 || p.discount_percent > 100) {
                return { valid: false, error: 'discount_percent должен быть числом от 0 до 100' };
            }
            return { valid: true, data: { discount_percent: p.discount_percent } };

        case 'referral_free':
            // referral_free может не требовать параметров или иметь свои
            return { valid: true, data: p as PromotionParams };

        default:
            return { valid: true, data: p as PromotionParams };
    }
}

/**
 * Извлекает booking_id из результата RPC (может быть строкой или объектом)
 */
export function extractBookingId(rpcResult: unknown): string | null {
    if (typeof rpcResult === 'string') {
        return rpcResult;
    }

    if (rpcResult && typeof rpcResult === 'object') {
        const rec = rpcResult as Record<string, unknown>;
        if (typeof rec.booking_id === 'string') {
            return rec.booking_id;
        }
        if (typeof rec.id === 'string') {
            return rec.id;
        }
    }

    return null;
}

