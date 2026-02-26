import { resolveBizContextForManagers } from './bizContextResolver';
import { resolveStaffContext } from './staffRoleSync';
export { BizAccessError } from './authDiagnostics';

/**
 * Возвращает { supabase, userId, bizId } для кабинета менеджмента.
 * Новый порядок определения:
 * 1) super_admin → current_biz_id (таблица user_current_business), без автоподбора чужих бизнесов
 * 2) current_biz_id (таблица user_current_business) с проверкой прав
 * 3) роли user_roles (owner|admin|manager) с детерминированным выбором
 * 4) Фоллбек: businesses.owner_id = user.id
 */
export async function getBizContextForManagers() {
    return resolveBizContextForManagers();
}

/**
 * Возвращает { supabase, userId, staffId, bizId } для кабинета сотрудника.
 * Проверяет наличие записи в staff с user_id, автоматически добавляет роль если её нет.
 */
export async function getStaffContext() {
    return resolveStaffContext();
}

