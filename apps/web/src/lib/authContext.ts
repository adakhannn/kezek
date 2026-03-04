/**
 * Централизованный модуль ролей и выбора кабинета.
 * Единый источник правды для: middleware, AuthStatusServer/Client, переключателей.
 *
 * @see docs/ROLES_AND_BUSINESS_SELECTION_AUDIT.md
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const MANAGER_ROLE_KEYS = new Set(['owner', 'admin', 'manager']);
const STAFF_ROLE_KEY = 'staff';
const _SUPER_ADMIN_ROLE_KEY = 'super_admin';

/** Роль пользователя в бизнесе (для дашборда). */
export type ManagerRoleKey = 'owner' | 'admin' | 'manager';

/** Элемент списка бизнесов с типом доступа. */
export type BusinessWithRole = { id: string; role: ManagerRoleKey };

/**
 * Профиль ролей пользователя (без привязки к UI).
 * Заполняется по данным: is_super_admin, my_role_keys, businesses, staff, user_roles.
 */
export interface UserRoleProfile {
    /** ID пользователя (auth.user.id). */
    userId: string;

    /** Супер-админ платформы. */
    isSuperAdmin: boolean;

    /** Владелец хотя бы одного бизнеса (businesses.owner_id). */
    hasOwnerBiz: boolean;

    /** Есть роль owner / admin / manager в user_roles (или владелец). */
    hasManagerRoles: boolean;

    /** Есть запись в staff (is_active) или роль staff в user_roles. */
    hasStaff: boolean;

    /** Доступ к личному кабинету клиента (всегда true для авторизованных). */
    isClient: boolean;

    /** Доступ в админ-панель. */
    canAdmin: boolean;

    /** Доступ в кабинет бизнеса (dashboard). */
    canDashboard: boolean;

    /** Доступ в кабинет сотрудника. */
    canStaff: boolean;

    /** Доступ в личный кабинет (мои записи). */
    canCabinet: boolean;

    /** Список бизнесов, к которым есть доступ как owner/admin/manager (id + роль). */
    businesses: BusinessWithRole[];
}

/**
 * Результат выбора кабинета по умолчанию.
 */
export type DefaultDashboardResult =
    | { path: '/admin' }
    | { path: '/dashboard' }
    | { path: '/select-business' }
    | { path: '/staff' }
    | { path: '/cabinet' };

/**
 * Собирает профиль ролей по данным Supabase (anon/server client с cookies).
 * Возвращает null, если пользователь не авторизован.
 */
export async function getUserRoleProfile(
    supabase: SupabaseClient
): Promise<UserRoleProfile | null> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return null;

    const userId = user.id;

    const [
        { data: isSuperAdmin },
        { data: roleKeys },
        { count: ownedCount },
        { data: staffRow },
        { data: ownedBusinesses },
        { data: userRolesRows },
    ] = await Promise.all([
        supabase.rpc('is_super_admin'),
        supabase.rpc('my_role_keys'),
        supabase
            .from('businesses')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', userId),
        supabase
            .from('staff')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle(),
        supabase
            .from('businesses')
            .select('id')
            .eq('owner_id', userId),
        supabase
            .from('user_roles')
            .select('biz_id, role_id')
            .eq('user_id', userId)
            .not('biz_id', 'is', null),
    ]);

    const keys = Array.isArray(roleKeys) ? (roleKeys as string[]) : [];
    const hasOwnerBiz = (ownedCount ?? 0) > 0;
    const hasStaffRecord = !!staffRow;
    const hasStaffRole = keys.includes(STAFF_ROLE_KEY);
    const hasStaff = hasStaffRecord || hasStaffRole;
    const hasManagerRoles =
        hasOwnerBiz ||
        keys.some((k) => MANAGER_ROLE_KEYS.has(k));
    const isSuper = !!isSuperAdmin;

    const businesses: BusinessWithRole[] = [];

    (ownedBusinesses ?? []).forEach((b: { id: string }) => {
        if (b?.id) businesses.push({ id: b.id, role: 'owner' });
    });

    if (userRolesRows?.length && !isSuper) {
        const roleIds = [...new Set((userRolesRows as { role_id: string }[]).map((r) => r.role_id))];
        const { data: roles } = await supabase
            .from('roles')
            .select('id, key')
            .in('id', roleIds);
        const roleIdToKey = new Map(
            (roles ?? []).map((r: { id: string; key: string }) => [r.id, r.key])
        );
        (userRolesRows as { biz_id: string; role_id: string }[]).forEach((r) => {
            if (!r.biz_id) return;
            const key = roleIdToKey.get(r.role_id);
            if (!key || !MANAGER_ROLE_KEYS.has(key)) return;
            const role = key as ManagerRoleKey;
            if (!businesses.some((b) => b.id === r.biz_id)) {
                businesses.push({ id: r.biz_id, role });
            }
        });
    }

    return {
        userId,
        isSuperAdmin: isSuper,
        hasOwnerBiz,
        hasManagerRoles,
        hasStaff,
        isClient: true,
        canAdmin: isSuper,
        canDashboard: isSuper || hasManagerRoles,
        canStaff: hasStaff,
        canCabinet: true,
        businesses,
    };
}

/**
 * Определяет путь редиректа с главной страницы по профилю.
 * Порядок приоритета: super_admin → admin; owner/manager → dashboard (или select-business); staff → staff; иначе cabinet.
 * Для перехода на /select-business нужны: несколько бизнесов и отсутствие текущего выбора (currentBizId не передаётся сюда — это решает вызывающий код).
 */
export function resolveDefaultDashboard(
    profile: UserRoleProfile | null
): DefaultDashboardResult {
    if (!profile) {
        return { path: '/cabinet' };
    }

    if (profile.isSuperAdmin) {
        return { path: '/admin' };
    }

    if (profile.hasManagerRoles) {
        return { path: '/dashboard' };
    }

    if (profile.hasStaff) {
        return { path: '/staff' };
    }

    return { path: '/cabinet' };
}

/**
 * Проверяет, нужно ли при редиректе с "/" отправить на /select-business:
 * у пользователя несколько бизнесов и нет записи в user_current_business.
 * Вызывать после resolveDefaultDashboard, когда path === '/dashboard'.
 */
export function shouldRedirectToSelectBusiness(
    profile: UserRoleProfile,
    hasCurrentBusiness: boolean
): boolean {
    if (!profile.hasManagerRoles) return false;
    if (hasCurrentBusiness) return false;
    return profile.businesses.length > 1;
}

/** Значение cookie выбранного кабинета (см. FIRST_LOGIN_ROLE_SELECTION_UX.md). */
export type PreferredCabinet = 'admin' | 'dashboard' | 'staff' | 'cabinet';

export const PREFERRED_CABINET_COOKIE_NAME = 'kezek_preferred_cabinet';

const PREFERRED_TO_PATH: Record<PreferredCabinet, string> = {
    admin: '/admin',
    dashboard: '/dashboard',
    staff: '/staff',
    cabinet: '/cabinet',
};

/**
 * Количество доступных типов кабинетов (1–4).
 * Используется для решения: показывать ли экран выбора кабинета (/select-cabinet).
 */
export function countAvailableCabinetTypes(profile: UserRoleProfile): number {
    let n = 0;
    if (profile.canAdmin) n++;
    if (profile.canDashboard) n++;
    if (profile.canStaff) n++;
    if (profile.canCabinet) n++;
    return n;
}

/**
 * Возвращает путь для сохранённого предпочтения, если оно допустимо для профиля; иначе null.
 */
export function getPathForPreferredCabinet(
    profile: UserRoleProfile,
    preferred: string | undefined
): string | null {
    if (!preferred || !Object.keys(PREFERRED_TO_PATH).includes(preferred)) return null;
    const path = PREFERRED_TO_PATH[preferred as PreferredCabinet];
    if (path === '/admin' && !profile.canAdmin) return null;
    if (path === '/dashboard' && !profile.canDashboard) return null;
    if (path === '/staff' && !profile.canStaff) return null;
    if (path === '/cabinet' && !profile.canCabinet) return null;
    return path;
}

/** По пути возвращает значение для cookie (для установки на клиенте). */
export function pathToPreferredCabinet(path: string): PreferredCabinet | null {
    const entry = Object.entries(PREFERRED_TO_PATH).find(([, p]) => p === path);
    return entry ? (entry[0] as PreferredCabinet) : null;
}
