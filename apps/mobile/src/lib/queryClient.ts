import { QueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '../lib/errors';
import { logError } from './log';
import { shouldRetryQuery } from './retryPolicy';

/**
 * Настроенный QueryClient с улучшенной обработкой ошибок
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: shouldRetryQuery,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            staleTime: 5 * 60 * 1000, // 5 минут
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchOnMount: true,
        },
        mutations: {
            retry: 0, // Мутации не повторяем автоматически
            onError: (error) => {
                // Логируем ошибки мутаций для отладки
                logError('QueryClient', 'Mutation error', { message: getErrorMessage(error) });
            },
        },
    },
});

