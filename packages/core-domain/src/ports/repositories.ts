import type {
    BookingStatus,
    PromotionApplied,
} from '../booking/types';

/**
 * Базовые интерфейсы репозиториев доменного слоя.
 *
 * Эти интерфейсы описывают то, что нужно доменной логике от хранилища,
 * без привязки к конкретной реализации (Supabase, другая БД и т.п.).
 */

export interface BookingRepository {
    /**
     * Возвращает бронирование по ID (минимальный набор полей для домена).
     */
    findById(id: string): Promise<{
        id: string;
        biz_id: string;
        branch_id: string;
        service_id: string;
        staff_id: string;
        status: BookingStatus;
        promotion_applied: PromotionApplied | null;
    } | null>;

    /**
     * Обновляет статус брони.
     */
    updateStatus(params: {
        bookingId: string;
        newStatus: BookingStatus;
    }): Promise<void>;
}

export interface BranchRepository {
    /**
     * Ищет активный филиал бизнеса по ID.
     */
    findActiveById(params: {
        bizId: string;
        branchId: string;
    }): Promise<{ id: string } | null>;

    /**
     * Возвращает первый активный филиал бизнеса (по дате создания).
     */
    findFirstActiveByBizId(bizId: string): Promise<{ id: string } | null>;
}

export interface StaffRepository {
    /**
     * Проверяет, существует ли активный сотрудник в указанном бизнесе.
     */
    existsActiveStaff(params: {
        bizId: string;
        staffId: string;
    }): Promise<boolean>;
}

export interface PromotionRepository {
    /**
     * Возвращает количество использований промоакции по её ID (для ограничений).
     */
    getUsageCount(promotionId: string): Promise<number>;
}

