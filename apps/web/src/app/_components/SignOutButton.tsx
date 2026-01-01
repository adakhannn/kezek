'use client';

import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export function SignOutButton({ className }: { className?: string }) {
    const [loading, setLoading] = useState(false);

    const handleSignOut = (e: React.MouseEvent<HTMLButtonElement>) => {
        console.log('[SignOut] Button clicked!', e);
        e.preventDefault();
        e.stopPropagation();
        
        if (loading) {
            console.log('[SignOut] Already loading, ignoring click');
            return;
        }
        
        setLoading(true);
        console.log('[SignOut] Starting sign out...');
        
        // Пытаемся выполнить выход, но не ждем его завершения
        // Редирект произойдет сразу, а signOut выполнится в фоне
        supabase.auth.signOut()
            .then(({ error }) => {
                if (error) {
                    console.error('[SignOut] Error:', error);
                } else {
                    console.log('[SignOut] Sign out successful');
                }
            })
            .catch((error) => {
                console.error('[SignOut] Exception:', error);
            });

        // Немедленный редирект - не ждем завершения signOut
        // Это гарантирует, что пользователь не останется в зависшем состоянии
        setTimeout(() => {
            console.log('[SignOut] Redirecting...');
            window.location.href = '/';
        }, 100);
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
