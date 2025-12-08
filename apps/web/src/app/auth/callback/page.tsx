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
            const maxAttempts = 5; // Уменьшили количество попыток

            const checkSession = async () => {
                try {
                    // Проверяем hash с токенами (старый способ)
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const accessToken = hashParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                        console.log('AuthCallback: Setting session from hash');
                        // Устанавливаем сессию из hash
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (error) {
                            console.error('AuthCallback: setSession error', error);
                            throw error;
                        }
                        console.log('AuthCallback: Session set successfully, redirecting');
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                        return;
                    }

                    // Если есть code в URL, пытаемся обменять
                    const code = searchParams.get('code');
                    if (code) {
                        console.log('AuthCallback: Found code in URL, attempting exchange');
                        try {
                            // Пытаемся обменять код на сессию
                            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                            if (!error && data.session) {
                                console.log('AuthCallback: Code exchanged successfully, redirecting');
                                setStatus('success');
                                router.refresh();
                                router.replace(next);
                                return;
                            } else if (error) {
                                console.warn('AuthCallback: exchangeCodeForSession error', error);
                            }
                        } catch (e) {
                            console.warn('AuthCallback: exchangeCodeForSession exception', e);
                        }
                    }

                    // Проверяем наличие сессии
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                    
                    if (sessionError) {
                        console.warn('AuthCallback: getSession error', sessionError);
                    }

                    if (session?.user) {
                        console.log('AuthCallback: Session found, redirecting');
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                        return;
                    }

                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(`AuthCallback: No session yet, attempt ${attempts}/${maxAttempts}, retrying...`);
                        setTimeout(checkSession, 1000); // Увеличили задержку до 1 секунды
                    } else {
                        console.log('AuthCallback: Max attempts reached, redirecting anyway');
                        // После нескольких попыток редиректим (сессия может быть установлена на сервере)
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                    }
                } catch (e) {
                    console.error('AuthCallback: callback error', e);
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkSession, 1000);
                    } else {
                        console.log('AuthCallback: Max attempts reached after error, redirecting');
                        // В конце концов редиректим - если авторизация произошла, middleware перенаправит
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                    }
                }
            };

            // Небольшая задержка перед первой проверкой, чтобы дать время Supabase обработать
            setTimeout(checkSession, 100);
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
