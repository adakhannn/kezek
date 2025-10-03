'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
    const sp = useSearchParams();
    const router = useRouter();
    const redirect = sp.get('redirect') || '/';

    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                // Меняем code+state из URL на сессию
                const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
                if (error) throw error;
                router.replace(redirect);
            } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
            }
        })();
    }, [router, redirect]);

    return (
        <main className="mx-auto max-w-sm p-6 space-y-3">
            <div className="text-sm">Выполняем вход…</div>
            {err && <div className="text-red-600 text-sm">Ошибка: {err}</div>}
        </main>
    );
}
