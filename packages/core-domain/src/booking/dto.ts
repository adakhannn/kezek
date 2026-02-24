/**
 * DTO (Data Transfer Objects) для бронирований и промоакций
 * Преобразование между структурами БД и доменными объектами
 */

import type { BookingStatus, PromotionType, PromotionApplied } from './types';

/**
 * DTO бронирования (упрощённая версия для API ответов)
 */
export type BookingDto = {
    id: string;
    biz_id: string;
    branch_id: string;
    service_id: string;
    staff_id: string;
    client_id?: string | null;
    client_name?: string | null;
    client_phone?: string | null;
    client_email?: string | null;
    status: BookingStatus;
    start_at: string;
    end_at: string;
    expires_at?: string | null;
    created_at: string;
    promotion_applied?: PromotionApplied | null;
};

/**
 * DTO промоакции
 */
export type PromotionDto = {
    id: string;
    branch_id: string;
    biz_id: string;
    promotion_type: PromotionType;
    title_ru: string;
    title_ky?: string | null;
    title_en?: string | null;
    description_ru?: string | null;
    description_ky?: string | null;
    description_en?: string | null;
    params: Record<string, unknown>;
    is_active: boolean;
    valid_from?: string | null;
    valid_to?: string | null;
    created_at: string;
    usage_count?: number;
};

/**
 * Преобразует строку бронирования из БД в единый DTO-формат (поля в snake_case, null вместо undefined).
 *
 * @param booking - Строка из таблицы bookings (или выборки с теми же полями)
 * @returns BookingDto с нормализованным promotion_applied
 */
export function transformBookingToDto(booking: {
    id: string;
    biz_id: string;
    branch_id: string;
    service_id: string;
    staff_id: string;
    client_id?: string | null;
    client_name?: string | null;
    client_phone?: string | null;
    client_email?: string | null;
    status: BookingStatus;
    start_at: string;
    end_at: string;
    expires_at?: string | null;
    created_at: string;
    promotion_applied?: unknown;
}): BookingDto {
    return {
        id: booking.id,
        biz_id: booking.biz_id,
        branch_id: booking.branch_id,
        service_id: booking.service_id,
        staff_id: booking.staff_id,
        client_id: booking.client_id ?? null,
        client_name: booking.client_name ?? null,
        client_phone: booking.client_phone ?? null,
        client_email: booking.client_email ?? null,
        status: booking.status,
        start_at: booking.start_at,
        end_at: booking.end_at,
        expires_at: booking.expires_at ?? null,
        created_at: booking.created_at,
        promotion_applied: normalizePromotionApplied(booking.promotion_applied),
    };
}

/**
 * Нормализует поле promotion_applied из БД (JSONB может быть объектом или null).
 *
 * @param promotionApplied - Значение из bookings.promotion_applied
 * @returns Объект PromotionApplied с типизированными полями или null
 */
export function normalizePromotionApplied(
    promotionApplied: unknown
): PromotionApplied | null {
    if (!promotionApplied) {
        return null;
    }

    if (typeof promotionApplied === 'object' && promotionApplied !== null) {
        const obj = promotionApplied as Record<string, unknown>;
        
        // Проверяем, что есть хотя бы promotion_type
        if (typeof obj.promotion_type === 'string') {
            return {
                promotion_id: typeof obj.promotion_id === 'string' ? obj.promotion_id : undefined,
                promotion_type: obj.promotion_type as PromotionType,
                promotion_title: typeof obj.promotion_title === 'string' ? obj.promotion_title : undefined,
                discount_percent: typeof obj.discount_percent === 'number' ? obj.discount_percent : undefined,
                discount_amount: typeof obj.discount_amount === 'number' ? obj.discount_amount : undefined,
                final_amount: typeof obj.final_amount === 'number' ? obj.final_amount : undefined,
                ...obj,
            };
        }
    }

    return null;
}

/**
 * Преобразует строку промоакции из БД в DTO (единый формат полей, null для опциональных).
 *
 * @param promotion - Строка из branch_promotions (или выборки с теми же полями)
 * @returns PromotionDto
 */
export function transformPromotionToDto(promotion: {
    id: string;
    branch_id: string;
    biz_id: string;
    promotion_type: PromotionType;
    title_ru: string;
    title_ky?: string | null;
    title_en?: string | null;
    description_ru?: string | null;
    description_ky?: string | null;
    description_en?: string | null;
    params: Record<string, unknown>;
    is_active: boolean;
    valid_from?: string | null;
    valid_to?: string | null;
    created_at: string;
    usage_count?: number;
}): PromotionDto {
    return {
        id: promotion.id,
        branch_id: promotion.branch_id,
        biz_id: promotion.biz_id,
        promotion_type: promotion.promotion_type,
        title_ru: promotion.title_ru,
        title_ky: promotion.title_ky ?? null,
        title_en: promotion.title_en ?? null,
        description_ru: promotion.description_ru ?? null,
        description_ky: promotion.description_ky ?? null,
        description_en: promotion.description_en ?? null,
        params: promotion.params,
        is_active: promotion.is_active,
        valid_from: promotion.valid_from ?? null,
        valid_to: promotion.valid_to ?? null,
        created_at: promotion.created_at,
        usage_count: promotion.usage_count,
    };
}

