'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AuthStatusServer } from './AuthStatusServer';

import { supabase } from '@/lib/supabaseClient';


/**
 * Клиентский wrapper для AuthStatusServer, который отслеживает изменения авторизации
 * и автоматически обновляет серверные компоненты
 */
export function AuthStatusWrapper() {
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

    return <AuthStatusServer />;
}

