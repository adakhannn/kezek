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
        
        // Таймаут для гарантированного редиректа, даже если signOut зависнет
        const redirectTimeout = setTimeout(() => {
            console.log('[SignOut] Timeout - forcing redirect');
            window.location.href = '/';
        }, 2000);
        
        try {
            console.log('[SignOut] Starting sign out...');
            
            // Выполняем выход с таймаутом
            const signOutPromise = supabase.auth.signOut();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('SignOut timeout')), 1500)
            );
            
            const { error } = await Promise.race([signOutPromise, timeoutPromise]) as { error?: Error };
            
            clearTimeout(redirectTimeout);
            
            if (error) {
                console.error('[SignOut] Error:', error);
            } else {
                console.log('[SignOut] Sign out successful');
            }

            // Используем полный редирект для гарантированного обновления состояния
            // Это обновит все компоненты и очистит кэш
            window.location.href = '/';
        } catch (error) {
            clearTimeout(redirectTimeout);
            console.error('[SignOut] Exception:', error);
            // В случае ошибки все равно делаем редирект
            window.location.href = '/';
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
