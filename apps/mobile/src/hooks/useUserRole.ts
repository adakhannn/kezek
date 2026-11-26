import { useQuery } from '@tanstack/react-query';
import { logWarn } from '../lib/log';
import { fetchCurrentUser } from '../lib/currentUser';
import { supabase } from '../lib/supabase';

type UserRole = {
    /** Owns at least one business (businesses.owner_id). */
    isOwner: boolean;
    /**
     * Owns a business or holds an owner, admin or manager role in one (user_roles): the Business tab
     * (O3/B10), the rule of the website's dashboard (businessManagerAccess.ts).
     */
    isBusinessManager: boolean;
    isStaff: boolean;
    /** Informational: the platform admin works on the website, the app shows the tabs of their own roles. */
    isSuperAdmin: boolean;
};

const NO_ROLE: UserRole = { isOwner: false, isBusinessManager: false, isStaff: false, isSuperAdmin: false };

/** user_roles keys that open the business dashboard (MANAGER_ROLE_KEYS on the website). */
const MANAGER_ROLE_KEYS = new Set(['owner', 'admin', 'manager']);

async function hasManagerRole(userId: string): Promise<boolean> {
    const { data: rows, error } = await supabase
        .from('user_roles')
        .select('biz_id, role_id')
        .eq('user_id', userId)
        .not('biz_id', 'is', null);
    if (error) throw error;
    const roleIds = [...new Set((rows ?? []).map((row: { role_id: string | number }) => row.role_id))];
    if (roleIds.length === 0) return false;
    const { data: roles, error: rolesError } = await supabase.from('roles').select('id, key').in('id', roleIds);
    if (rolesError) throw rolesError;
    const held = new Set(roleIds.map(String));
    return (roles ?? []).some((role: { id: string | number; key: string }) =>
        held.has(String(role.id)) && MANAGER_ROLE_KEYS.has(String(role.key)));
}

/**
 * The roles that decide the tabs. Each check fails on its own: a failed check is logged and leaves
 * that role off, never the roles already known (a failed staff check keeps the owner, and back).
 */
export function useUserRole() {
    const userQuery = useQuery({
        queryKey: ['user'],
        queryFn: fetchCurrentUser,
    });
    const user = userQuery.data;

    const roleQuery = useQuery({
        queryKey: ['user-role', user?.id],
        queryFn: async (): Promise<UserRole> => {
            if (!user?.id) return NO_ROLE;

            // A super admin is treated like any user here (O3): admin tools are web-only, and the
            // tabs follow the businesses and staff cards of the account itself.
            const { data: isSuper, error: superError } = await supabase.rpc('is_super_admin');
            if (superError) {
                logWarn('useUserRole', 'Super admin check failed', { message: superError.message });
            }

            const [ownerResult, managerResult, staffResult] = await Promise.allSettled([
                supabase
                    .from('businesses')
                    .select('id', { count: 'exact', head: true })
                    .eq('owner_id', user.id),
                hasManagerRole(user.id),
                // A master can work in several businesses (one active card each), so cards are
                // counted rather than expecting exactly one (ARCH-02).
                supabase
                    .from('staff')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('is_active', true),
            ]);

            let isOwner = false;
            if (ownerResult.status === 'fulfilled' && !ownerResult.value.error) {
                isOwner = (ownerResult.value.count ?? 0) > 0;
            } else {
                const reason = ownerResult.status === 'fulfilled' ? ownerResult.value.error : ownerResult.reason;
                logWarn('useUserRole', 'Owner role check failed', { message: (reason as Error | null)?.message });
            }

            let hasRole = false;
            if (managerResult.status === 'fulfilled') {
                hasRole = managerResult.value;
            } else {
                logWarn('useUserRole', 'Manager role check failed', { message: (managerResult.reason as Error | null)?.message });
            }

            let isStaff = false;
            if (staffResult.status === 'fulfilled' && !staffResult.value.error) {
                isStaff = (staffResult.value.count ?? 0) > 0;
            } else {
                const reason = staffResult.status === 'fulfilled' ? staffResult.value.error : staffResult.reason;
                logWarn('useUserRole', 'Staff role check failed', { message: (reason as Error | null)?.message });
            }

            return { isOwner, isBusinessManager: isOwner || hasRole, isStaff, isSuperAdmin: !superError && Boolean(isSuper) };
        },
        enabled: !!user?.id,
    });

    return {
        ...(roleQuery.data || NO_ROLE),
        isLoading: userQuery.isLoading || (!!user?.id && roleQuery.isLoading),
        loadError: userQuery.error ?? roleQuery.error,
    };
}
