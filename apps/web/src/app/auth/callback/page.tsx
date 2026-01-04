'use client';

// Отключаем статическую генерацию для этой страницы (требуется для клиентских хуков)
export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useCallback } from 'react';

import { supabase } from '@/lib/supabaseClient';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');

    const fetchIsSuper = useCallback(async (): Promise<boolean> => {
        const { data, error } = await supabase.rpc('is_super_admin');
        if (error) {
            console.warn('[callback] is_super_admin error:', error.message);
            return false;
        }
        return !!data;
    }, []);

    const fetchOwnsBusiness = useCallback(async (userId?: string): Promise<boolean> => {
        if (!userId) return false;
        const { count, error } = await supabase
            .from('businesses')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', userId);
        if (error) {
            console.warn('[callback] owner check error:', error.message);
            return false;
        }
        return (count ?? 0) > 0;
    }, []);

    const decideRedirect = useCallback(
        async (fallback: string, userId?: string): Promise<string> => {
            if (await fetchIsSuper()) return '/admin';
            if (await fetchOwnsBusiness(userId)) return '/dashboard';
            
            // Проверяем наличие записи в staff (источник правды)
            if (userId) {
                try {
                    const { data: staff } = await supabase
                        .from('staff')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('is_active', true)
                        .maybeSingle();
                    
                    if (staff) return '/staff';
                } catch (error) {
                    console.warn('[callback] decideRedirect: error checking staff', error);
                }
            }
            
            // Fallback: проверяем через RPC
            try {
                const { data: roles } = await supabase.rpc('my_role_keys');
                const keys = Array.isArray(roles) ? (roles as string[]) : [];
                if (keys.includes('owner')) return '/dashboard';
                if (keys.includes('staff')) return '/staff';
                if (keys.some(r => ['admin', 'manager'].includes(r))) return '/dashboard';
            } catch (error) {
                console.warn('[callback] decideRedirect: error checking roles', error);
            }
            
            return fallback || '/';
        },
        [fetchIsSuper, fetchOwnsBusiness]
    );

    useEffect(() => {
        (async () => {
            const nextParam = searchParams.get('next');
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
                        const { data: { user } } = await supabase.auth.getUser();
                        const targetPath = await decideRedirect(nextParam || '/', user?.id);
                        console.log('[callback] Session set from hash, redirecting to:', targetPath);
                        setStatus('success');
                        // Принудительно обновляем страницу для обновления хедера
                        router.refresh();
                        // Небольшая задержка для установки cookies
                        await new Promise(resolve => setTimeout(resolve, 100));
                        window.location.href = targetPath;
                        return;
                    }

                    // 2. Если есть code в URL, пытаемся обменять (для OAuth providers)
                    const code = searchParams.get('code');
                    if (code) {
                        console.log('[callback] Found code parameter, attempting exchange');
                        try {
                            const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                            if (!exchangeError && sessionData?.session) {
                                const { data: { user } } = await supabase.auth.getUser();
                                const targetPath = await decideRedirect(nextParam || '/', user?.id);
                                console.log('[callback] Code exchanged successfully, redirecting to:', targetPath);
                                setStatus('success');
                                // Принудительно обновляем страницу для обновления хедера
                                router.refresh();
                                // Небольшая задержка для установки cookies
                                await new Promise(resolve => setTimeout(resolve, 100));
                                window.location.href = targetPath;
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
                        const { data: { user } } = await supabase.auth.getUser();
                        const targetPath = await decideRedirect(nextParam || '/', user?.id);
                        console.log('[callback] Session found, redirecting to:', targetPath);
                        setStatus('success');
                        // Принудительно обновляем страницу для обновления хедера
                        router.refresh();
                        // Небольшая задержка для установки cookies
                        await new Promise(resolve => setTimeout(resolve, 100));
                        window.location.href = targetPath;
                        return;
                    }

                    // 4. Если сессии нет, ждем и проверяем снова
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log('[callback] No session yet, waiting... (attempt', attempts, 'of', maxAttempts, ')');
                        setTimeout(checkSession, 1000); // Увеличил до 1 секунды
                    } else {
                        // После всех попыток редиректим - если авторизация произошла, middleware перенаправит
                        const { data: { user } } = await supabase.auth.getUser();
                        const targetPath = await decideRedirect(nextParam || '/', user?.id);
                        console.warn('[callback] Max attempts reached, redirecting anyway to:', targetPath);
                        setStatus('success');
                        router.refresh();
                        router.replace(targetPath);
                    }
                } catch (e) {
                    console.error('[callback] Error in checkSession:', e);
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkSession, 1000);
                    } else {
                        const { data: { user } } = await supabase.auth.getUser();
                        const targetPath = await decideRedirect(nextParam || '/', user?.id);
                        console.warn('[callback] Max attempts reached after error, redirecting to:', targetPath);
                        setStatus('success');
                        router.refresh();
                        router.replace(targetPath);
                    }
                }
            };

            checkSession();
        })();
    }, [router, searchParams, decideRedirect]);

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

