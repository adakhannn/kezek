'use client';

// Отключаем статическую генерацию для этой страницы (требуется для клиентских хуков)
export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useCallback } from 'react';

import { FullScreenStatus } from '@/app/_components/FullScreenStatus';
import {logDebug, logError, logWarn} from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');

    const fetchIsSuper = useCallback(async (): Promise<boolean> => {
        const { data, error } = await supabase.rpc('is_super_admin');
        if (error) {
            logWarn('Callback', 'is_super_admin error', { error: error.message });
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
            logWarn('Callback', 'owner check error', { userId, error: error.message });
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
                    logWarn('Callback', 'decideRedirect: error checking staff', error);
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
                logWarn('Callback', 'decideRedirect: error checking roles', error);
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
                    logDebug('Callback', 'Attempt', { attempt: attempts + 1, url: window.location.href });
                    
                    // 1. Проверяем hash с токенами (старый способ)
                    const hash = window.location.hash.substring(1);
                    logDebug('Callback', 'Hash check', { hash: hash ? hash.substring(0, 50) + '...' : 'empty' });
                    const hashParams = new URLSearchParams(hash);
                    const accessToken = hashParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                        logDebug('Callback', 'Found tokens in hash, setting session', { 
                            accessTokenLength: accessToken.length,
                            refreshTokenLength: refreshToken.length 
                        });
                        
                        const { data: sessionData, error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        
                        if (error) {
                            logError('Callback', 'setSession error', error);
                            throw error;
                        }
                        
                        logDebug('Callback', 'Session set successfully', { hasSession: !!sessionData?.session });
                        
                        // Проверяем, что сессия действительно установлена
                        const { data: { user }, error: userError } = await supabase.auth.getUser();
                        if (userError) {
                            logError('Callback', 'getUser error after setSession', userError);
                            throw userError;
                        }
                        
                        if (!user) {
                            logError('Callback', 'No user after setSession');
                            throw new Error('No user after setting session');
                        }
                        
                        logDebug('Callback', 'User confirmed', { userId: user.id });
                        
                        // Теперь используем постоянный баннер вместо модального окна
                        
                        const targetPath = await decideRedirect(nextParam || '/', user?.id);
                        logDebug('Callback', 'Session set from hash, redirecting', { targetPath });
                        setStatus('success');
                        // Принудительно обновляем страницу для обновления хедера
                        router.refresh();
                        // Небольшая задержка для установки cookies
                        await new Promise(resolve => setTimeout(resolve, 200));
                        window.location.href = targetPath;
                        return;
                    }

                    // 2. Если есть code в URL, пытаемся обменять (для OAuth providers)
                    const code = searchParams.get('code');
                    if (code) {
                        logDebug('Callback', 'Found code parameter, attempting exchange');
                        try {
                            const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                            if (!exchangeError && sessionData?.session) {
                                const { data: { user } } = await supabase.auth.getUser();
                                
                                // Теперь используем постоянный баннер вместо модального окна
                                
                                const targetPath = await decideRedirect(nextParam || '/', user?.id);
                                logDebug('Callback', 'Code exchanged successfully, redirecting', { targetPath });
                                setStatus('success');
                                // Принудительно обновляем страницу для обновления хедера
                                router.refresh();
                                // Небольшая задержка для установки cookies
                                await new Promise(resolve => setTimeout(resolve, 100));
                                window.location.href = targetPath;
                                return;
                            } else {
                                logWarn('Callback', 'exchangeCodeForSession error', exchangeError);
                                // Продолжаем - возможно Supabase обработал на сервере
                            }
                        } catch (e) {
                            logWarn('Callback', 'exchangeCodeForSession exception', e);
                            // Продолжаем проверку
                        }
                    }

                    // 3. Проверяем наличие сессии (Supabase может установить её автоматически через cookies)
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                    
                    if (session && !sessionError) {
                        const { data: { user } } = await supabase.auth.getUser();
                        
                        // Теперь используем постоянный баннер вместо модального окна
                        
                        const targetPath = await decideRedirect(nextParam || '/', user?.id);
                        logDebug('Callback', 'Session found, redirecting', { targetPath });
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
                        logDebug('Callback', 'No session yet, waiting', { attempt: attempts, maxAttempts });
                        setTimeout(checkSession, 1000); // Увеличил до 1 секунды
                    } else {
                        // После всех попыток редиректим - если авторизация произошла, middleware перенаправит
                        const { data: { user } } = await supabase.auth.getUser();
                        const targetPath = await decideRedirect(nextParam || '/', user?.id);
                        logWarn('Callback', 'Max attempts reached, redirecting anyway', { targetPath });
                        setStatus('success');
                        router.refresh();
                        router.replace(targetPath);
                    }
                } catch (e) {
                    logError('Callback', 'Error in checkSession', e);
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkSession, 1000);
                    } else {
                        const { data: { user } } = await supabase.auth.getUser();
                        const targetPath = await decideRedirect(nextParam || '/', user?.id);
                        logWarn('Callback', 'Max attempts reached after error, redirecting', { targetPath });
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
            <FullScreenStatus
                title="Не удалось завершить авторизацию"
                subtitle="Попробуйте перезагрузить страницу или войти ещё раз"
                message="Если проблема повторяется, закройте вкладку, откройте сайт заново и выполните вход ещё раз. 
Мы автоматически восстановим ваш сеанс, когда это возможно."
                loading={false}
            />
        );
    }

    return (
        <FullScreenStatus
            title="Авторизация…"
            subtitle="Подтверждаем вход и настраиваем ваш кабинет"
            message="Обычно это занимает не больше пары секунд. Пожалуйста, не закрывайте эту вкладку — вы будете автоматически перенаправлены в нужный раздел."
            loading
        />
    );
}

export default function AuthCallback() {
    return (
        <Suspense fallback={
            <FullScreenStatus
                title="Загрузка…"
                subtitle="Готовим страницу авторизации"
                loading
            />
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}

