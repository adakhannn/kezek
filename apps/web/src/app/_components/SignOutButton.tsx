'use client';

import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export function SignOutButton({ className }: { className?: string }) {
    const [loading, setLoading] = useState(false);

    const handleSignOut = (e: React.MouseEvent<HTMLButtonElement>) => {
        console.log('[SignOut] Button clicked!');
        e.preventDefault();
        e.stopPropagation();
        
        if (loading) {
            console.log('[SignOut] Already loading, ignoring click');
            return;
        }
        
        setLoading(true);
        console.log('[SignOut] Starting sign out...');
        
        // Выполняем выход асинхронно, но не блокируем редирект
        supabase.auth.signOut()
            .then(({ error }) => {
                if (error) {
                    console.error('[SignOut] Supabase signOut error:', error);
                } else {
                    console.log('[SignOut] Supabase signOut successful');
                }
            })
            .catch((error) => {
                console.error('[SignOut] Exception:', error);
            });
        
        // Очищаем localStorage (включая все ключи Supabase)
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log('[SignOut] Cleared localStorage keys:', keysToRemove.length);
        } catch (localStorageError) {
            console.warn('[SignOut] Error clearing localStorage:', localStorageError);
        }
        
        // Очищаем sessionStorage
        try {
            sessionStorage.clear();
            console.log('[SignOut] Cleared sessionStorage');
        } catch (sessionStorageError) {
            console.warn('[SignOut] Error clearing sessionStorage:', sessionStorageError);
        }
        
        // Немедленный редирект - не ждем завершения signOut
        console.log('[SignOut] Redirecting...');
        // Небольшой таймаут, чтобы дать время на выполнение очистки
        setTimeout(() => {
            console.log('[SignOut] Executing redirect now');
            window.location.href = '/';
        }, 50);
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
