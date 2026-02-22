/**
 * Базовые типы DTO для клиентских приложений (web и mobile)
 * 
 * Переиспользуются из core-domain модулей для единообразия
 */

// Реэкспортируем типы из core-domain для удобства
export type {
    BookingStatus,
    PromotionType,
    PromotionApplied,
    BookingDto,
    PromotionDto,
} from '@core-domain/booking';

// Дополнительные типы, специфичные для клиентских приложений

/**
 * Базовый тип для слотов расписания
 */
export type Slot = {
    staff_id: string;
    branch_id: string;
    start_at: string; // ISO-строка
    end_at: string; // ISO-строка
};

/**
 * Временной перевод мастера между филиалами
 */
export type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string; // YYYY-MM-DD
};

/**
 * Базовая информация о сотруднике
 */
export type StaffInfo = {
    id: string;
    branch_id: string;
    full_name?: string;
    email?: string | null;
    phone?: string | null;
};

/**
 * Базовая информация о филиале
 */
export type BranchInfo = {
    id: string;
    biz_id: string;
    name: string;
    address?: string | null;
    is_active: boolean;
};

/**
 * Базовая информация об услуге
 */
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

