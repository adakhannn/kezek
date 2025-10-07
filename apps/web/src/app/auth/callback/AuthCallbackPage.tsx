'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
    const sp = useSearchParams();
    const router = useRouter();

    const code   = sp.get('code');
    const state  = sp.get('state');
    const errMsg = sp.get('error_description') || sp.get('error');

    const redirect = sp.get('redirect') || '/';
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        // Если Supabase уже вернул ошибку в строке запроса — показываем её
        if (errMsg) {
            setErr(errMsg);
            return;
        }

        // Ждём, пока реально появятся code + state
        if (!code || !state) return;

        (async () => {
            const { error } = await supabase.auth.exchangeCodeForSession(
                window.location.href
            );
            if (error) {
                // Частый кейс: письмо открыли в другом браузере → нет code_verifier
                // В этом случае показываем подсказку и не зацикливаемся
                setErr(
                    error.message.includes('code verifier')
                        ? 'Не удалось завершить вход: ссылка открыта в другом браузере или истёк код. Вернитесь в то же окно, откуда запрашивали ссылку, и попробуйте снова.'
                        : error.message
                );
                return;
            }
            router.replace(redirect);
        })();
    }, [code, state, errMsg, redirect, router]);

    return (
        <main className="mx-auto max-w-sm p-6 space-y-3">
            {!err ? (
                <div className="text-sm">Выполняем вход…</div>
            ) : (
                <div className="text-red-600 text-sm">Ошибка: {err}</div>
            )}
        </main>
    );
}
