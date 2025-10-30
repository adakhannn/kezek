'use client';

import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabaseClient';

export function SignOutButton({ className }: { className?: string }) {
    const router = useRouter();

    return (
        <button
            type="button"
            className={className ?? 'border rounded px-3 py-1'}
            onClick={async () => {
                await supabase.auth.signOut();
                router.refresh(); // обновим серверные компоненты
            }}
        >
            Выйти
        </button>
    );
}
