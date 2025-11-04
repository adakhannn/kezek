'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
    const r = useRouter();

    useEffect(() => {
        (async () => {
            try {
                // Обрабатывает и ?code=... (PKCE), и #access_token=... (hash)
                const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
                if (error) throw error;
                r.replace('/auth/post-signup'); // здесь можешь дочитать full_name из localStorage и записать в metadata
            } catch (e) {
                console.error('callback error', e);
                r.replace('/auth/sign-in?error=callback');
            }
        })();
    }, []);

    return <div className="p-6 text-sm text-gray-600">Авторизация…</div>;
}
