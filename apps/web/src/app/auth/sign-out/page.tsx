'use client';
import {useEffect} from 'react';

import {supabase} from '@/lib/supabaseClient';

export default function SignOutPage() {
    useEffect(() => {
        (async () => {
            try {
                // 1. Вызываем API endpoint для принудительного выхода
                try {
                    await fetch('/api/auth/sign-out', { method: 'POST' });
                } catch (apiErr) {
                    console.warn('[sign-out] API sign-out error:', apiErr);
                }

                // 2. Выполняем выход через клиент
                try {
                    await supabase.auth.signOut();
                } catch (clientErr) {
                    console.warn('[sign-out] Client sign-out error:', clientErr);
                }
                
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

                // 4. Удаляем все cookies вручную
                try {
                    const cookies = document.cookie.split(';');
                    cookies.forEach(cookie => {
                        const eqPos = cookie.indexOf('=');
                        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                        // Удаляем cookie для текущего домена и для всех путей
                        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
                        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
                    });
                } catch (cookieErr) {
                    console.warn('[sign-out] Cookie clear error:', cookieErr);
                }

                // 5. Редирект на главную
                setTimeout(() => {
                    window.location.href = '/';
                }, 100);
            } catch (err) {
                console.error('[sign-out] Error:', err);
                // В любом случае делаем редирект
                setTimeout(() => {
                    window.location.href = '/';
                }, 100);
            }
        })();
    }, []);
    return <div>Выходим…</div>;
}
