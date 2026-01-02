'use client';

// Отключаем статическую генерацию для этой страницы (требуется для клиентских хуков)
export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');

    useEffect(() => {
        (async () => {
            const next = searchParams.get('next') || '/';
            let attempts = 0;
            const maxAttempts = 10;

            const checkSession = async () => {
                try {
                    // Проверяем hash с токенами (старый способ)
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const accessToken = hashParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                        // Устанавливаем сессию из hash
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (error) throw error;
                        
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                        return;
                    }

                    // Проверяем наличие сессии (Supabase может установить её автоматически через cookies)
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                    
                    if (session && !sessionError) {
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                        return;
                    }

                    // Если есть code в URL, пытаемся обменять
                    // Для OAuth (Google и др.) Supabase может обработать code автоматически
                    const code = searchParams.get('code');
                    if (code && attempts === 0) {
                        try {
                            // Пытаемся обменять code на сессию
                            // Для OAuth providers (Google) это должно работать без code_verifier
                            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                            if (!exchangeError) {
                                setStatus('success');
                                router.refresh();
                                router.replace(next);
                                return;
                            } else {
                                console.warn('[callback] exchangeCodeForSession error:', exchangeError);
                                // Продолжаем проверку сессии - возможно Supabase обработал на сервере
                            }
                        } catch (e) {
                            // Игнорируем ошибку, продолжаем проверку сессии
                            console.warn('[callback] exchangeCodeForSession exception:', e);
                        }
                    }

                    attempts++;
                    if (attempts < maxAttempts) {
                        // Ждем немного и проверяем снова (Supabase может обработать на своей стороне)
                        setTimeout(checkSession, 500);
                    } else {
                        // После нескольких попыток редиректим (сессия может быть установлена на сервере)
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                    }
                } catch (e) {
                    console.error('callback error', e);
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkSession, 500);
                    } else {
                        // В конце концов редиректим - если авторизация произошла, middleware перенаправит
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                    }
                }
            };

            checkSession();
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

export default function AuthCallback() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <div className="text-sm text-gray-600">Загрузка…</div>
                </div>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}
