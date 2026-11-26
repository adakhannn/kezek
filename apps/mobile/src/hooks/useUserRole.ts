import { useQuery } from '@tanstack/react-query';
import { logWarn } from '../lib/log';
import { fetchCurrentUser } from '../lib/currentUser';
import { supabase } from '../lib/supabase';

type UserRole = {
    isOwner: boolean;
    isStaff: boolean;
    isSuperAdmin: boolean;
};

/**
 * Хук для проверки роли пользователя
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
            if (!user?.id) {
                return { isOwner: false, isStaff: false, isSuperAdmin: false };
            }

            // Проверяем супер-админа
            const { data: isSuper } = await supabase.rpc('is_super_admin');
            if (isSuper) {
                return { isOwner: true, isStaff: false, isSuperAdmin: true };
            }

            // Проверяем владельца бизнеса
            const { count: ownerCount } = await supabase
                .from('businesses')
                .select('id', { count: 'exact', head: true })
                .eq('owner_id', user.id)
                .eq('is_approved', true);

            const isOwner = (ownerCount ?? 0) > 0;

            // Проверяем сотрудника. Мастер может работать в нескольких бизнесах (по активной
            // карточке в каждом), поэтому считаем карточки, а не ждём ровно одну (ARCH-02).
            const { count: staffCount, error: staffError } = await supabase
                .from('staff')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_active', true);

            // Ошибка проверки сотрудника не отменяет уже известную роль владельца.
            if (staffError) {
                logWarn('useUserRole', 'Staff role check failed', { message: staffError.message });
            }
            const isStaff = !staffError && (staffCount ?? 0) > 0;

            return { isOwner, isStaff, isSuperAdmin: false };
        },
        enabled: !!user?.id,
    });

    return {
        ...(roleQuery.data || { isOwner: false, isStaff: false, isSuperAdmin: false }),
        isLoading: userQuery.isLoading || (!!user?.id && roleQuery.isLoading),
        loadError: userQuery.error ?? roleQuery.error,
    };
}

