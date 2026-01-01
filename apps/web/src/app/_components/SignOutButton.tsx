'use client';

import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export function SignOutButton({ className }: { className?: string }) {
    const [loading, setLoading] = useState(false);

    const handleSignOut = async (e: React.MouseEvent<HTMLButtonElement>) => {
        console.log('[SignOut] Button clicked!', e);
        e.preventDefault();
        e.stopPropagation();
        
        if (loading) {
            console.log('[SignOut] Already loading, ignoring click');
            return;
        }
        
        setLoading(true);
        console.log('[SignOut] Starting sign out...');
        
        try {
            // Очищаем все данные сессии
            // 1. Вызываем signOut через Supabase
            const { error: signOutError } = await supabase.auth.signOut();
            
            if (signOutError) {
                console.error('[SignOut] Supabase signOut error:', signOutError);
            } else {
                console.log('[SignOut] Supabase signOut successful');
            }
            
            // 2. Очищаем localStorage (включая все ключи Supabase)
            try {
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => {
                    localStorage.removeItem(key);
                    console.log('[SignOut] Removed localStorage key:', key);
                });
            } catch (localStorageError) {
                console.warn('[SignOut] Error clearing localStorage:', localStorageError);
            }
            
            // 3. Очищаем sessionStorage
            try {
                sessionStorage.clear();
                console.log('[SignOut] Cleared sessionStorage');
            } catch (sessionStorageError) {
                console.warn('[SignOut] Error clearing sessionStorage:', sessionStorageError);
            }
            
            // 4. Удаляем все cookies, связанные с Supabase
            try {
                const cookies = document.cookie.split(';');
                cookies.forEach(cookie => {
                    const eqPos = cookie.indexOf('=');
                    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                    if (name.includes('supabase') || name.includes('sb-') || name.includes('auth')) {
                        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
                        console.log('[SignOut] Removed cookie:', name);
                    }
                });
            } catch (cookieError) {
                console.warn('[SignOut] Error clearing cookies:', cookieError);
            }
            
            console.log('[SignOut] All session data cleared, redirecting...');
            
            // Редирект после очистки
            window.location.href = '/';
        } catch (error) {
            console.error('[SignOut] Exception during sign out:', error);
            // Даже при ошибке делаем редирект и очистку
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch (clearError) {
                console.warn('[SignOut] Error during cleanup:', clearError);
            }
            window.location.href = '/';
        }
    };

    return (
        <button
            type="button"
            className={className ?? 'px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed'}
            onClick={handleSignOut}
            onMouseDown={(e) => {
                console.log('[SignOut] Mouse down event');
                e.preventDefault();
            }}
            disabled={loading}
            style={{ position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
        >
            {loading ? 'Выход...' : 'Выйти'}
        </button>
    );
}
