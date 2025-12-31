'use client';

import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export function SignOutButton({ className }: { className?: string }) {
    const [loading, setLoading] = useState(false);

    const handleSignOut = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (loading) return;
        
        setLoading(true);
        
        try {
            console.log('[SignOut] Starting sign out...');
            
            // Выполняем выход
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                console.error('[SignOut] Error:', error);
                // Даже при ошибке делаем редирект, чтобы очистить состояние
            } else {
                console.log('[SignOut] Sign out successful');
            }

            // Используем полный редирект для гарантированного обновления состояния
            // Это обновит все компоненты и очистит кэш
            window.location.href = '/';
        } catch (error) {
            console.error('[SignOut] Exception:', error);
            // В случае ошибки все равно делаем редирект
            window.location.href = '/';
        } finally {
            // Если редирект не произошел, сбрасываем состояние
            setTimeout(() => {
                setLoading(false);
            }, 2000);
        }
    };

    return (
        <button
            type="button"
            className={className ?? 'px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed'}
            onClick={handleSignOut}
            disabled={loading}
        >
            {loading ? 'Выход...' : 'Выйти'}
        </button>
    );
}
