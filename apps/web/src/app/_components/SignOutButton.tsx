'use client';

import { supabase } from '@/lib/supabaseClient';

export function SignOutButton({ className }: { className?: string }) {
    const handleSignOut = async () => {
        // Выполняем выход (не ждем завершения)
        supabase.auth.signOut().catch(console.error);
        
        // Очищаем данные сессии
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

        // Редирект на страницу выхода, которая обработает все правильно
        window.location.href = '/auth/sign-out';
    };

    return (
        <button
            type="button"
            className={className ?? 'px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 text-sm'}
            onClick={handleSignOut}
        >
            Выйти
        </button>
    );
}
