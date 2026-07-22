import type { SupabaseClient } from '@supabase/supabase-js';

export const MANAGER_ROLE_KEYS = new Set(['owner', 'admin', 'manager']);
const STAFF_ROLE_KEY = 'staff';

export type ManagerRoleKey = 'owner' | 'admin' | 'manager';

export type BusinessWithRole = { id: string; role: ManagerRoleKey };

export function hasBusinessDashboardAccess(isSuperAdmin: boolean, hasBusinessAssociation: boolean): boolean {
    return !isSuperAdmin && hasBusinessAssociation;
}

export interface UserRoleProfile {
    userId: string;
    isSuperAdmin: boolean;
    hasOwnerBiz: boolean;
    hasManagerRoles: boolean;
    hasStaff: boolean;
    isClient: boolean;
    canAdmin: boolean;
    canDashboard: boolean;
    canStaff: boolean;
    canCabinet: boolean;
    businesses: BusinessWithRole[];
}

export async function getUserRoleProfile(
    supabase: SupabaseClient,
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
        supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
        supabase
            .from('staff')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle(),
        supabase.from('businesses').select('id').eq('owner_id', userId),
        supabase.from('user_roles').select('biz_id, role_id').eq('user_id', userId).not('biz_id', 'is', null),
    ]);

    const keys = Array.isArray(roleKeys) ? (roleKeys as string[]) : [];
    const isSuper = !!isSuperAdmin;
    const hasOwnerBiz = (ownedCount ?? 0) > 0;
    const hasStaffRecord = !!staffRow;
    const hasStaffRole = keys.includes(STAFF_ROLE_KEY);
    const hasStaff = hasStaffRecord || hasStaffRole;
    const hasManagerRoles = hasBusinessDashboardAccess(
        isSuper,
        hasOwnerBiz || keys.some((k) => MANAGER_ROLE_KEYS.has(k)),
    );

    const businesses: BusinessWithRole[] = [];

    if (!isSuper) {
        (ownedBusinesses ?? []).forEach((b: { id: string }) => {
            if (b?.id) businesses.push({ id: b.id, role: 'owner' });
        });
    }

    if (!isSuper && userRolesRows?.length) {
        const roleIds = [...new Set((userRolesRows as { role_id: string }[]).map((r) => r.role_id))];
        const { data: roles } = await supabase.from('roles').select('id, key').in('id', roleIds);
        const roleIdToKey = new Map(
            (roles ?? []).map((r: { id: string; key: string }) => [r.id, r.key]),
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
        canDashboard: hasManagerRoles,
        canStaff: hasStaff,
        canCabinet: true,
        businesses,
    };
}
