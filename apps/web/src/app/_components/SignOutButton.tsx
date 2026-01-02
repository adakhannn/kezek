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
        
        setLoading(true);
        
        // Выполняем выход асинхронно
        supabase.auth.signOut().catch(console.error);
        
        // Очищаем все данные сессии
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
        } catch (err) {
            console.warn('[SignOut] localStorage error:', err);
        }
        
        try {
            sessionStorage.clear();
        } catch (err) {
            console.warn('[SignOut] sessionStorage error:', err);
        }
        
        // Редирект - используем replace для более надежного редиректа
        console.log('[SignOut] Redirecting...');
        setTimeout(() => {
            console.log('[SignOut] Executing redirect now');
            // Используем location.replace вместо href
            window.location.replace('/');
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
