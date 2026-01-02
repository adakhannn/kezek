import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Хук для проверки авторизации пользователя
 */
export function useAuth() {
    const { data: user, isLoading, error } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        },
        staleTime: 5 * 60 * 1000, // 5 минут
    });

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        error,
    };
}

