import { QueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '../lib/errors';

/**
 * Настроенный QueryClient с улучшенной обработкой ошибок
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (failureCount, error) => {
                // Не повторяем запросы для ошибок авторизации
                if (error && typeof error === 'object' && 'message' in error) {
                    const message = String(error.message).toLowerCase();
                    if (message.includes('unauthorized') || message.includes('401')) {
                        return false;
                    }
                }
                // Повторяем до 2 раз для других ошибок
                return failureCount < 2;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            staleTime: 5 * 60 * 1000, // 5 минут
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: true,
        },
        mutations: {
            retry: 0, // Мутации не повторяем автоматически
            onError: (error) => {
                // Логируем ошибки мутаций для отладки
                console.error('Mutation error:', getErrorMessage(error));
            },
        },
    },
});

