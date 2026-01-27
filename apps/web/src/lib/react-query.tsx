'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function ReactQueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Время жизни кэша: 5 минут
                        staleTime: 5 * 60 * 1000,
                        // Время хранения в кэше: 10 минут
                        gcTime: 10 * 60 * 1000,
                        // Повторные попытки при ошибке
                        retry: 1,
                        // Не рефетчить при фокусе окна
                        refetchOnWindowFocus: false,
                        // Не рефетчить при переподключении
                        refetchOnReconnect: false,
                    },
                },
            })
    );

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

