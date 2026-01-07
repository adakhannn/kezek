'use client';

import { useLanguage } from './i18n/LanguageProvider';

import { supabase } from '@/lib/supabaseClient';

export function SignOutButton({ className }: { className?: string }) {
    const { t } = useLanguage();
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
            className={className ?? 'flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 text-sm'}
            onClick={handleSignOut}
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">{t('header.signOut', 'Выйти')}</span>
        </button>
    );
}
