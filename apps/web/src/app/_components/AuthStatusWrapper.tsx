'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabaseClient';

/**
 * Клиентский компонент, который отслеживает изменения авторизации
 * и автоматически обновляет серверные компоненты
 * 
 * Этот компонент не рендерит ничего, только подписывается на изменения
 */
export function AuthStatusUpdater() {
    const router = useRouter();

    useEffect(() => {
        // Подписываемся на изменения состояния авторизации
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
            // При изменении состояния авторизации обновляем серверные компоненты
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                router.refresh();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

    // Этот компонент ничего не рендерит
    return null;
}

