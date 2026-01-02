'use client';

import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export function SignOutButton({ className }: { className?: string }) {
    const [loading, setLoading] = useState(false);

    const handleSignOut = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (loading) {
            return;
        }
        
        console.log('[SignOut] Step 1: Setting loading state');
        setLoading(true);
        
        console.log('[SignOut] Step 2: Starting signOut');
        // Выполняем выход асинхронно, но не блокируем редирект
        supabase.auth.signOut()
            .then(({ error }) => {
                console.log('[SignOut] Step 3: signOut completed', error ? 'with error' : 'successfully');
                if (error) {
                    console.error('[SignOut] Supabase signOut error:', error);
                }
            })
            .catch((error) => {
                console.error('[SignOut] signOut exception:', error);
            });
        
        console.log('[SignOut] Step 4: Clearing localStorage');
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
            console.log('[SignOut] Step 5: Cleared', keysToRemove.length, 'localStorage keys');
        } catch (localStorageError) {
            console.warn('[SignOut] Error clearing localStorage:', localStorageError);
        }
        
        console.log('[SignOut] Step 6: Clearing sessionStorage');
        // Очищаем sessionStorage
        try {
            sessionStorage.clear();
            console.log('[SignOut] Step 7: Cleared sessionStorage');
        } catch (sessionStorageError) {
            console.warn('[SignOut] Error clearing sessionStorage:', sessionStorageError);
        }
        
        console.log('[SignOut] Step 8: Setting redirect timeout');
        // Немедленный редирект - не ждем завершения signOut
        setTimeout(() => {
            console.log('[SignOut] Step 9: Executing redirect');
            window.location.href = '/';
        }, 100);
        
        console.log('[SignOut] Step 10: Function completed');
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
