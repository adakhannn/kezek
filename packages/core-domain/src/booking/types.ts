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
 * Параметры для создания бронирования (авторизованный пользователь)
 */
export type CreateBookingParams = {
    biz_id: string;
    branch_id?: string | null; // опционально, если не указан - берется первый активный
    service_id: string;
    staff_id: string;
    start_at: string; // ISO-строка с таймзоной
};

/**
 * Параметры для создания гостевой брони
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

