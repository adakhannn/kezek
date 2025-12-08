'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');

    useEffect(() => {
        (async () => {
            try {
                // Получаем параметр next из query string
                const next = searchParams.get('next') || '/';

                // Проверяем, есть ли в URL hash с токенами (старый способ)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (accessToken && refreshToken) {
                    // Старый способ через hash
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (error) throw error;
                } else {
                    // Новый способ через PKCE code
                    // Извлекаем code из query string
                    const code = searchParams.get('code');
                    if (!code) {
                        // Если нет code, проверяем, может быть уже есть сессия
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                            setStatus('success');
                            router.replace(next);
                            return;
                        }
                        throw new Error('No authorization code found');
                    }

                    // Обмениваем code на сессию
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                }

                setStatus('success');
                router.replace(next);
            } catch (e) {
                console.error('callback error', e);
                setStatus('error');
                // Даем время Supabase обработать на своей стороне, затем редиректим
                setTimeout(() => {
                    const next = searchParams.get('next') || '/';
                    router.replace(next);
                }, 2000);
            }
        })();
    }, [router, searchParams]);

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="text-sm text-gray-600">Обработка авторизации...</div>
                    <div className="text-xs text-gray-500">Если авторизация не произошла, попробуйте войти снова</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="text-center space-y-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <div className="text-sm text-gray-600">Авторизация…</div>
            </div>
        </div>
    );
}
