'use client';
import {useEffect} from 'react';

import {supabase} from '@/lib/supabaseClient';

export default function SignOutPage() {
    useEffect(() => {
        // Таймаут для гарантированного редиректа через 2 секунды
        const forceRedirectTimeout = setTimeout(() => {
            console.log('[sign-out] Force redirect after timeout');
            window.location.replace('/');
        }, 2000);

        // Выполняем все операции параллельно, не ждем завершения
        Promise.allSettled([
            // 1. API endpoint (не ждем)
            fetch('/api/auth/sign-out', { method: 'POST' }).catch(() => {}),
            
            // 2. Клиентский signOut (не ждем)
            supabase.auth.signOut().catch(() => {}),
        ]).then(() => {
            // После завершения всех операций (или ошибок) очищаем хранилище
            try {
                // Очищаем localStorage
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
                
                // Очищаем sessionStorage
                sessionStorage.clear();
            } catch (err) {
                console.warn('[sign-out] Storage clear error:', err);
            }

            // Удаляем cookies
            try {
                const cookies = document.cookie.split(';');
                cookies.forEach(cookie => {
                    const eqPos = cookie.indexOf('=');
                    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                });
            } catch (cookieErr) {
                console.warn('[sign-out] Cookie clear error:', cookieErr);
            }

            // Очищаем таймаут и делаем редирект
            clearTimeout(forceRedirectTimeout);
            window.location.replace('/');
        }).catch(() => {
            // В случае ошибки все равно делаем редирект
            clearTimeout(forceRedirectTimeout);
            window.location.replace('/');
        });

        return () => {
            clearTimeout(forceRedirectTimeout);
        };
    }, []);
    return <div>Выходим…</div>;
}
