'use client';

import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabaseClient';

export function SignOutButton({ className }: { className?: string }) {
    const router = useRouter();

    return (
        <button
            type="button"
            className={className ?? 'px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 text-sm'}
            onClick={async () => {
                await supabase.auth.signOut();
                // Редиректим на главную страницу после выхода
                router.push('/');
                router.refresh(); // обновим серверные компоненты
            }}
        >
            Выйти
        </button>
    );
}
