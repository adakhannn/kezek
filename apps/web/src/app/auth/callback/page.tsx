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
                    console.log('[callback] Attempt:', attempts + 1, 'URL:', window.location.href);
                    
                    // 1. Проверяем hash с токенами (старый способ)
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const accessToken = hashParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                        console.log('[callback] Found tokens in hash, setting session');
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (error) {
                            console.error('[callback] setSession error:', error);
                            throw error;
                        }
                        console.log('[callback] Session set from hash, redirecting to:', next);
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                        return;
                    }

                    // 2. Если есть code в URL, пытаемся обменять (для OAuth providers)
                    const code = searchParams.get('code');
                    if (code) {
                        console.log('[callback] Found code parameter, attempting exchange');
                        try {
                            const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                            if (!exchangeError && sessionData?.session) {
                                console.log('[callback] Code exchanged successfully, redirecting to:', next);
                                setStatus('success');
                                router.refresh();
                                router.replace(next);
                                return;
                            } else {
                                console.warn('[callback] exchangeCodeForSession error:', exchangeError);
                                // Продолжаем - возможно Supabase обработал на сервере
                            }
                        } catch (e) {
                            console.warn('[callback] exchangeCodeForSession exception:', e);
                            // Продолжаем проверку
                        }
                    }

                    // 3. Проверяем наличие сессии (Supabase может установить её автоматически через cookies)
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                    
                    if (session && !sessionError) {
                        console.log('[callback] Session found, redirecting to:', next);
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                        return;
                    }

                    // 4. Если сессии нет, ждем и проверяем снова
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log('[callback] No session yet, waiting... (attempt', attempts, 'of', maxAttempts, ')');
                        setTimeout(checkSession, 1000); // Увеличил до 1 секунды
                    } else {
                        // После всех попыток редиректим - если авторизация произошла, middleware перенаправит
                        console.warn('[callback] Max attempts reached, redirecting anyway to:', next);
                        setStatus('success');
                        router.refresh();
                        router.replace(next);
                    }
                } catch (e) {
                    console.error('[callback] Error in checkSession:', e);
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkSession, 1000);
                    } else {
                        console.warn('[callback] Max attempts reached after error, redirecting to:', next);
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

