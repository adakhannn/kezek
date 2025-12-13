'use client';

import { supabase } from '@/lib/supabaseClient';

export function SignOutButton({ className }: { className?: string }) {
    const handleSignOut = async () => {
        try {
            // Выполняем выход
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                console.error('SignOut error:', error);
                return;
            }

            // Используем полный редирект для гарантированного обновления состояния
            // Это обновит все компоненты и очистит кэш
            window.location.href = '/';
        } catch (error) {
            console.error('SignOut exception:', error);
            // В случае ошибки все равно делаем редирект
            window.location.href = '/';
        }
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
