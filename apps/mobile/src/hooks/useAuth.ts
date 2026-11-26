import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from '../lib/currentUser';

/**
 * Хук для проверки авторизации пользователя
 */
export function useAuth() {
    const { data: user, isLoading, error } = useQuery({
        queryKey: ['user'],
        queryFn: fetchCurrentUser,
        staleTime: 5 * 60 * 1000, // 5 минут
    });

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        error,
    };
}

