/**
 * Базовые типы DTO для клиентских приложений (web и mobile)
 * Типы бронирований/промо объявлены здесь, чтобы shared-client не зависел от workspace-пакета core-domain при установке (Vercel CI).
 */

/** Статусы бронирования */
export type BookingStatus = 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';

/** Типы промоакций */
export type PromotionType =
    | 'free_after_n_visits'
    | 'referral_free'
    | 'referral_discount_50'
    | 'birthday_discount'
    | 'first_visit_discount';

/** Применённая промоакция в бронировании */
export type PromotionApplied = {
    promotion_id?: string;
    promotion_type: PromotionType;
    promotion_title?: string;
    discount_percent?: number;
    discount_amount?: number;
    final_amount?: number;
    [key: string]: unknown;
};

/** DTO бронирования (упрощённая версия для API ответов) */
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

/** DTO промоакции */
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

// Дополнительные типы, специфичные для клиентских приложений

/** Базовый тип для слотов расписания */
export type Slot = {
    staff_id: string;
    branch_id: string;
    start_at: string;
    end_at: string;
};

/** Временной перевод мастера между филиалами */
export type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string;
};

/** Базовая информация о сотруднике */
export type StaffInfo = {
    id: string;
    branch_id: string;
    full_name?: string;
    email?: string | null;
    phone?: string | null;
};

/** Базовая информация о филиале */
export type BranchInfo = {
    id: string;
    biz_id: string;
    name: string;
    address?: string | null;
    is_active: boolean;
};

/** Базовая информация об услуге */
export type ServiceInfo = {
    id: string;
    biz_id: string;
    branch_id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from?: number | null;
    price_to?: number | null;
    active: boolean;
};
