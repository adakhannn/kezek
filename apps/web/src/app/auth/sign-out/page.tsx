'use client';
import {useEffect} from 'react';

import {supabase} from '@/lib/supabaseClient';

export default function SignOutPage() {
    useEffect(() => {
        // Таймаут для гарантированного редиректа, даже если signOut зависнет
        const redirectTimeout = setTimeout(() => {
            console.log('[sign-out] Timeout - forcing redirect');
            location.href = '/';
        }, 2000);

        (async () => {
            try {
                // Выполняем выход (не ждем завершения)
                supabase.auth.signOut().catch(console.error);
                
                // Очищаем данные сессии (для WhatsApp авторизации)
                try {
                    const keysToRemove: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                } catch (err) {
                    // Игнорируем ошибки
                }

                try {
                    sessionStorage.clear();
                } catch (err) {
                    // Игнорируем ошибки
                }

                // Очищаем таймаут и делаем редирект
                clearTimeout(redirectTimeout);
                location.href = '/';
            } catch (err) {
                console.error('[sign-out] Error:', err);
                clearTimeout(redirectTimeout);
                location.href = '/';
            }
        })();

        return () => {
            clearTimeout(redirectTimeout);
        };
    }, []);
    return <div>Выходим…</div>;
}
