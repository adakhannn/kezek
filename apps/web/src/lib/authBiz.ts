import { cache } from 'react';

import { BizAccessError } from './authDiagnostics';
import { resolveBizContextForManagers } from './bizContextResolver';
import { resolveStaffContext, type StaffContext } from './staffRoleSync';
export { BizAccessError, StaffSelectionRequiredError } from './authDiagnostics';
export type { StaffOption } from './authDiagnostics';

// A cabinet layout and its page render in parallel and both need the context: each used to sign the
// user in again (auth.getUser) and re-read the cards, roles and current business (ARCH-10). React
// cache shares one resolution per server render; route handlers are not memoized and resolve per call.
const resolveManagerContextOnce = cache(() => resolveBizContextForManagers());
const resolveStaffContextOnce = cache(() => resolveStaffContext());

/**
 * Возвращает { supabase, userId, bizId } для кабинета менеджмента.
 * Новый порядок определения:
 * 1) super_admin → current_biz_id (таблица user_current_business), без автоподбора чужих бизнесов
 * 2) current_biz_id (таблица user_current_business) с проверкой прав
 * 3) роли user_roles (owner|admin|manager) с детерминированным выбором
 * 4) Фоллбек: businesses.owner_id = user.id
 */
export async function getBizContextForManagers() {
    return resolveManagerContextOnce();
}

/**
 * Возвращает { supabase, userId, staffId, bizId, branchId, staffOptions } для кабинета сотрудника.
 * Человек может работать мастером в нескольких бизнесах (ARCH-02): карточка выбирается по
 * заголовку X-Kezek-Staff-Id, затем по запомненной (cookie kezek_staff_id), затем единственная;
 * иначе StaffSelectionRequiredError со списком карточек. Только чтение: роль staff следует за
 * карточкой в базе (триггер staff_ensure_staff_role, ARCH-10).
 */
export async function getStaffContext() {
    return resolveStaffContextOnce();
}

/**
 * Контекст сотрудника для страниц кабинета, которые рендерятся параллельно с layout: null при
 * отказе доступа (layout сам показывает вход, выбор бизнеса или ошибку), остальные ошибки летят дальше.
 */
export async function getStaffPageContext(): Promise<StaffContext | null> {
    try {
        return await resolveStaffContextOnce();
    } catch (error) {
        if (error instanceof BizAccessError) return null;
        throw error;
    }
}

export async function getStaffContextForRequest(req: Request, scope?: string, selection?: { staffId?: string | null }) {
    const { resolveStaffContextForRequest } = await import('./staffRoleSync');
    return resolveStaffContextForRequest(req, scope, selection);
}
