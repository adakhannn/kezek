/**
 * Типы для доменной логики бронирований и промоакций
 */

/**
 * Статусы бронирования
 */
export type BookingStatus = 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';

/**
 * Типы промоакций
 */
export type PromotionType = 
    | 'free_after_n_visits' 
    | 'referral_free' 
    | 'referral_discount_50' 
    | 'birthday_discount' 
    | 'first_visit_discount';

/**
 * Параметры промоакции (зависят от типа)
 */
export type PromotionParams = 
    | { visit_count: number } // free_after_n_visits
    | { discount_percent: number } // birthday_discount, first_visit_discount, referral_discount_50
    | Record<string, unknown>; // другие типы

/**
 * Применённая промоакция в бронировании
 */
export type PromotionApplied = {
    promotion_id?: string;
    promotion_type: PromotionType;
    promotion_title?: string;
    discount_percent?: number;
    discount_amount?: number;
    final_amount?: number;
    [key: string]: unknown;
};

/**
 * Описание одной услуги в составе бронирования.
 * Используется для поддержки комплексов услуг (несколько услуг за один визит).
 */
export type BookingServiceItem = {
    service_id: string;
    duration_min: number;
    order_index?: number;
    price_from?: number;
    price_to?: number;
};

/**
 * Параметры для создания бронирования (авторизованный пользователь)
 *
 * Для обратной совместимости пока сохраняем обязательный service_id.
 * Поле services зарезервировано под поддержку комплексов услуг и
 * может быть не заполнено на первом этапе внедрения.
 */
export type CreateBookingParams = {
    biz_id: string;
    branch_id?: string | null; // опционально, если не указан - берется первый активный
    service_id: string;
    staff_id: string;
    start_at: string; // ISO-строка с таймзоной
    services?: BookingServiceItem[];
};

/**
 * Параметры для создания гостевой брони
 *
 * Аналогично CreateBookingParams, поле services добавлено для будущей
 * поддержки комплексов услуг, при этом service_id остаётся обязательным.
 */
export type CreateGuestBookingParams = {
    biz_id: string;
    branch_id: string;
    service_id: string;
    staff_id: string;
    start_at: string; // ISO-строка с таймзоной
    client_name: string;
    client_phone: string;
    client_email?: string | null;
    services?: BookingServiceItem[];
};

/**
 * Параметры для обновления статуса бронирования
 */
export type UpdateBookingStatusParams = {
    booking_id: string;
    new_status: BookingStatus;
    apply_promotion?: boolean; // применять ли промоакцию (для статуса 'paid')
};

/**
 * Результат применения промоакции
 */
export type PromotionApplicationResult = {
    applied: boolean;
    promotion_title?: string | null;
    discount_percent?: number | null;
    discount_amount?: number | null;
    final_amount?: number | null;
} | null;

