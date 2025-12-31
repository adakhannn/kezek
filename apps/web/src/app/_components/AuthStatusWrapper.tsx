'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { supabase } from '@/lib/supabaseClient';

/**
 * Клиентский компонент, который отслеживает изменения авторизации
 * и автоматически обновляет серверные компоненты
 * 
 * Этот компонент не рендерит ничего, только подписывается на изменения
 */
export function AuthStatusUpdater() {
    const router = useRouter();
    const lastSessionRef = useRef<string | null>(null);

    useEffect(() => {
        let mounted = true;

        // Функция для проверки и обновления сессии
        const checkAndRefresh = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const currentUserId = session?.user?.id || null;
                
                // Если сессия изменилась, обновляем серверные компоненты
                if (lastSessionRef.current !== currentUserId) {
                    lastSessionRef.current = currentUserId;
                    if (mounted) {
                        router.refresh();
                    }
                }
            } catch (error) {
                // Игнорируем ошибки проверки сессии
                console.warn('AuthStatusUpdater: session check error', error);
            }
        };

        // Проверяем сессию сразу при монтировании (с небольшой задержкой для установки cookies)
        const initialTimeout = setTimeout(() => {
            if (mounted) {
                checkAndRefresh();
            }
        }, 100);

        // Подписываемся на изменения состояния авторизации
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            const currentUserId = session?.user?.id || null;
            
            // При изменении состояния авторизации обновляем серверные компоненты
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                lastSessionRef.current = currentUserId;
                
                // Если пользователь вошел, проверяем наличие имени в профиле
                if (event === 'SIGNED_IN' && session?.user) {
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', session.user.id)
                            .maybeSingle();
                        
                        // Если имени нет, перенаправляем на страницу ввода имени
                        if (!profile?.full_name?.trim()) {
                            const currentPath = window.location.pathname;
                            // Не перенаправляем, если уже на странице post-signup или auth
                            if (!currentPath.startsWith('/auth/post-signup') && 
                                !currentPath.startsWith('/auth/sign-in') && 
                                !currentPath.startsWith('/auth/sign-up') &&
                                !currentPath.startsWith('/auth/whatsapp') &&
                                !currentPath.startsWith('/auth/callback')) {
                                router.push('/auth/post-signup?from=whatsapp');
                                return;
                            }
                        }
                    } catch (error) {
                        console.warn('AuthStatusUpdater: error checking profile name', error);
                    }
                }
                
                router.refresh();
            } else if (event === 'USER_UPDATED') {
                // Также обновляем при изменении данных пользователя
                checkAndRefresh();
            }
        });

        // Периодическая проверка сессии (на случай, если событие не сработало)
        const intervalId = setInterval(() => {
            if (mounted) {
                checkAndRefresh();
            }
        }, 2000); // Проверяем каждые 2 секунды

        return () => {
            mounted = false;
            clearTimeout(initialTimeout);
            clearInterval(intervalId);
            subscription.unsubscribe();
        };
    }, [router]);

    // Этот компонент ничего не рендерит
    return null;
}

