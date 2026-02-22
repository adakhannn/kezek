/**
 * Типы для доменной логики расписаний и слотов
 */

/**
 * Слот времени, возвращаемый RPC get_free_slots_service_day_v2
 */
export type RawSlot = {
    staff_id: string;
    branch_id: string;
    start_at: string; // ISO
    end_at: string;   // ISO
};

/**
 * Нормализованный слот времени (пока совпадает с RawSlot, но может быть расширен)
 */
export type Slot = RawSlot;

/**
 * Временный перевод мастера
 */
export type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string; // yyyy-MM-dd
};

/**
 * Краткая информация о сотруднике для вычисления расписания
 */
export type StaffInfo = {
    id: string;
    branch_id: string;
};

/**
 * Контекст для фильтрации слотов
 */
export type SlotFilterContext = {
    /**
     * ID мастера; специальное значение 'any' означает «любой мастер»
     */
    staffId: string;
    /**
     * Выбранный филиал (для обычного сценария, без временного перевода)
     */
    branchId: string;
    /**
     * Целевой филиал для временного перевода (если есть)
     */
    targetBranchId?: string | null;
    /**
     * Флаг временного перевода
     */
    isTemporaryTransfer: boolean;
    /**
     * Минимальное время начала слота (обычно now + 30 минут)
     */
    minStart?: Date;
};

/**
 * Результат вычисления контекста расписания с учётом временных переводов
 */
export type ScheduleContext = {
    isTemporaryTransfer: boolean;
    targetBranchId: string;
    homeBranchId?: string;
};


