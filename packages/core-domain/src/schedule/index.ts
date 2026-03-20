/**
 * Доменный модуль расписаний и слотов.
 *
 * Содержит чистые функции для:
 * - вычисления контекста расписания (учёт временных переводов);
 * - фильтрации слотов по мастеру, филиалу и времени.
 *
 * Не зависит от Supabase или React.
 */

export type {
    RawSlot,
    Slot,
    TemporaryTransfer,
    StaffInfo,
    SlotFilterContext,
    ScheduleContext,
    ServiceInfo,
} from './types';

export { filterStaffByBookingAvailability } from './availability';
export { resolveScheduleContext, filterSlotsByContext, filterServicesForStaff } from './helpers';


