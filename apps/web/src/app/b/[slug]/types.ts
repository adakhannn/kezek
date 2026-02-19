/**
 * Типы данных для формы бронирования
 */

export type Biz = {
    id: string;
    slug: string;
    name: string;
    address: string;
    phones: string[];
    rating_score: number | null;
    tz?: string | null;
};

export type Branch = {
    id: string;
    name: string;
    address?: string | null;
    rating_score: number | null;
};

export type Service = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from?: number | null;
    price_to?: number | null;
    branch_id: string;
};

export type Staff = {
    id: string;
    full_name: string;
    branch_id: string;
    avatar_url?: string | null;
    rating_score: number | null;
};

export type Promotion = {
    id: string;
    branch_id: string;
    promotion_type: string;
    title_ru: string | null;
    params: Record<string, unknown>;
    branches?: { name: string };
};

export type Data = {
    biz: Biz;
    branches: Branch[];
    services: Service[];
    staff: Staff[];
    promotions?: Promotion[];
};

// Связь услуга ↔ мастер
export type ServiceStaffRow = {
    service_id: string;
    staff_id: string;
    is_active: boolean;
};

// RPC get_free_slots_service_day_v2
export type Slot = {
    staff_id: string;
    branch_id: string;
    start_at: string;
    end_at: string;
};

export type BookingStep = 1 | 2 | 3 | 4 | 5;

