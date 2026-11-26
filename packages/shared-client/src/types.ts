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

/** Описание одной услуги в составе бронирования (для комплексов услуг) */
export type BookingServiceItem = {
    service_id: string;
    duration_min: number;
    order_index?: number;
    price_from?: number;
    price_to?: number;
};

/** DTO бронирования (упрощённая версия для API ответов) */
export type BookingDto = {
    id: string;
    biz_id: string;
    branch_id: string;
    service_id: string;
    /** Состав услуг визита; при отсутствующем массиве считать, что визит состоит из одной услуги service_id */
    services?: BookingServiceItem[];
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

/** DTO запроса для quick-hold (v1) */
export type QuickHoldRequestDto = {
    biz_id: string;
    branch_id?: string;
    service_id: string;
    staff_id: string;
    start_at: string;
};

/** DTO ответа для quick-hold (v1) */
export type QuickHoldResponseDto = {
    booking_id: string;
    confirmed: boolean;
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

/** Публичный DTO бизнеса для мобильного и веб-клиентов */
export type PublicBusinessDto = {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    phones: string[] | null;
    categories: string[] | null;
    rating_score: number | null;
};

/** One service of a booking (booking_services, in booking order). */
export type ClientBookingServiceDto = {
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number | null;
};

/** A promotion applied to the booking (bookings.promotion_applied, written by booking commands). */
export type ClientBookingPromotionDto = {
    /** The Russian title recorded by the booking command (promotion_title), else the promotion type. */
    title: string | null;
    /**
     * Kyrgyz and English titles of the promotion (branch_promotions.title_ky/title_en); null when
     * not filled in or the promotion is no longer readable. Absent from older servers.
     */
    title_ky?: string | null;
    title_en?: string | null;
    discount_percent: number | null;
    /** Amount after the promotion, in som; null when the command did not record it. */
    final_amount: number | null;
};

/** The visit is paid with a visit package (bookings.subscription_applied). */
export type ClientBookingPackageDto = {
    name: string | null;
    final_amount: number | null;
};

/** The client's own review of the visit. */
export type ClientBookingReviewDto = {
    id: string;
    rating: number;
    comment: string | null;
};

/** Paging of GET /api/mobile/bookings (offset-based, newest start first). */
export type ClientBookingsPageDto = {
    offset: number;
    limit: number;
    has_more: boolean;
    next_offset: number | null;
};

/**
 * Additive fields of the cabinet list and details (C11). All are absent from older servers, so
 * every reader treats a missing field as "unknown" and keeps the old rendering.
 */
export type ClientBookingExtrasDto = {
    /** All services of a multi-service booking, in order; absent or empty for older rows. */
    services?: ClientBookingServiceDto[];
    promotion?: ClientBookingPromotionDto | null;
    package?: ClientBookingPackageDto | null;
    /** The client's review; only in the client's own view. */
    review?: ClientBookingReviewDto | null;
    /** The client may leave a review now (own booking, paid, visit started, no review yet). */
    can_review?: boolean;
};

/** Элемент списка броней в мобильном/веб-кабинете клиента */
export type ClientBookingListItemDto = ClientBookingExtrasDto & {
    id: string;
    start_at: string;
    end_at: string;
    status: BookingStatus;
    service: {
        name_ru: string | null;
        /** services.name_ky/name_en; absent from older servers. */
        name_ky?: string | null;
        name_en?: string | null;
    } | null;
    staff: {
        full_name: string | null;
    } | null;
    branch: {
        name: string | null;
        address: string | null;
    } | null;
    business: {
        name: string | null;
        slug?: string | null;
        /** IANA zone of the business (businesses.tz, validated; Asia/Bishkek when unset). Absent from older servers. */
        tz?: string;
    } | null;
};

/**
 * Who reads the booking details (B1): the client, the booking's own active master, or an owner,
 * admin or manager of the business. Staff viewers get no client-only actions and no review.
 */
export type BookingDetailsViewerRole = 'client' | 'staff' | 'manager';

/** DTO деталей бронирования для мобильного приложения */
export type ClientBookingDetailsDto = ClientBookingExtrasDto & {
    id: string;
    start_at: string;
    end_at: string;
    status: BookingStatus;
    service: {
        name_ru: string;
        /** services.name_ky/name_en; absent from older servers. */
        name_ky?: string | null;
        name_en?: string | null;
        duration_min: number;
        price_from: number | null;
        price_to: number | null;
    } | null;
    staff: {
        full_name: string;
    } | null;
    branch: {
        name: string;
        address: string | null;
        /** Branch coordinates for the map and directions; absent from older servers. */
        lat?: number | null;
        lon?: number | null;
    } | null;
    business: {
        name: string;
        slug?: string;
        phones: string[];
        /** IANA zone of the business (businesses.tz, validated; Asia/Bishkek when unset). Absent from older servers. */
        tz?: string;
    } | null;
    /** The booking's business, branch and master: the reschedule slots are theirs. Absent from older servers. */
    biz_id?: string;
    branch_id?: string;
    staff_id?: string;
    /** A promotion or package is applied: the business, not the client, reschedules it. Absent from older servers. */
    benefit_applied?: boolean;
    /** Absent from older servers, which served only the client. */
    viewer_role?: BookingDetailsViewerRole;
    /** The client's name, as the staff screens show it; only for staff viewers. */
    client_name?: string | null;
};

