'use client';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function PostSignup() {
    useEffect(() => {
        (async () => {
            const name = localStorage.getItem('signup_full_name');
            if (name) {
                await supabase.auth.updateUser({ data: { full_name: name } });
                localStorage.removeItem('signup_full_name');
            }
            location.replace('/'); // куда вести после регистрации
        })();
    }, []);
    return <main className="p-6 text-sm">Завершаем регистрацию…</main>;
}
