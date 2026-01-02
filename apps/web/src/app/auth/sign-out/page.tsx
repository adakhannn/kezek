'use client';
import {useEffect} from 'react';

import {supabase} from '@/lib/supabaseClient';

export default function SignOutPage() {
    useEffect(() => {
        let mounted = true;
        
        // Таймаут для гарантированного редиректа через 1.5 секунды
        const forceRedirectTimeout = setTimeout(() => {
            if (mounted) {
                console.log('[sign-out] Force redirect after timeout');
                window.location.replace('/');
            }
        }, 1500);

        (async () => {
            try {
                // 1. Вызываем API endpoint для принудительного выхода
                try {
                    await fetch('/api/auth/sign-out', { 
                        method: 'POST',
                        signal: AbortSignal.timeout(1000), // Таймаут 1 секунда
                    });
                } catch (apiErr) {
                    console.warn('[sign-out] API sign-out error:', apiErr);
                }

                // 2. Выполняем выход через клиент
                try {
                    await Promise.race([
                        supabase.auth.signOut(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
                    ]);
                } catch (clientErr) {
                    console.warn('[sign-out] Client sign-out error:', clientErr);
                }
                
                if (!mounted) return;
                
                // 3. Очищаем все данные сессии
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

                // 4. Удаляем cookies
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

                if (!mounted) return;
                
                // 5. Очищаем таймаут и делаем редирект
                clearTimeout(forceRedirectTimeout);
                window.location.replace('/');
            } catch (err) {
                console.error('[sign-out] Error:', err);
                if (mounted) {
                    clearTimeout(forceRedirectTimeout);
                    window.location.replace('/');
                }
            }
        })();

        return () => {
            mounted = false;
            clearTimeout(forceRedirectTimeout);
        };
    }, []);
    return <div>Выходим…</div>;
}
