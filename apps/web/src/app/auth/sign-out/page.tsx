'use client';
import {useEffect} from 'react';

import {supabase} from '@/lib/supabaseClient';

export default function SignOutPage() {
    useEffect(() => {
        (async () => {
            // Выполняем выход
            await supabase.auth.signOut().catch(console.error);
            
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

            // Редирект на главную
            location.href = '/';
        })();
    }, []);
    return <div>Выходим…</div>;
}
