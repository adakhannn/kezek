/**
 * Доменный модуль кабинета сотрудника: выбор карточки сотрудника, от имени которой действует
 * запрос, когда человек работает в нескольких бизнесах (ARCH-02). Не зависит от Supabase или React.
 */

export type { StaffCardPick, StaffCardRef } from './selection';
export { pickStaffCard, sortStaffCards } from './selection';
