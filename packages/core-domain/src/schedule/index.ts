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
} from './types';

export { resolveScheduleContext, filterSlotsByContext } from './helpers';


