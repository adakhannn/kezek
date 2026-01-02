import { useQuery } from '@tanstack/react-query';
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
    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        },
    });

    const { data: role, isLoading } = useQuery({
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

            // Проверяем сотрудника
            const { data: staff } = await supabase
                .from('staff')
                .select('id')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();

            const isStaff = !!staff;

            return { isOwner, isStaff, isSuperAdmin: false };
        },
        enabled: !!user?.id,
    });

    return {
        ...(role || { isOwner: false, isStaff: false, isSuperAdmin: false }),
        isLoading,
    };
}

