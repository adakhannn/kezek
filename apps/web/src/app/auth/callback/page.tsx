'use client';

// Отключаем статическую генерацию для этой страницы (требуется для клиентских хуков)
export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useCallback } from 'react';

import { FullScreenStatus } from '@/app/_components/FullScreenStatus';
import { WhatsAppConnectPrompt } from '@/app/_components/WhatsAppConnectPrompt';
import { supabase } from '@/lib/supabaseClient';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
    const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);

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
                        
                        // Проверяем, нет ли телефона у пользователя (для всех способов входа)
                        if (user && !user.phone) {
                            // Проверяем, не показывали ли мы уже это предложение
                            const hasSeenPrompt = localStorage.getItem('whatsapp_prompt_seen') === 'true';
                            if (!hasSeenPrompt) {
                                console.log('[callback] User without phone, showing WhatsApp prompt');
                                setShowWhatsAppPrompt(true);
                                setStatus('success');
                                return;
                            }
                        }
                        
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
                                
                                // Проверяем, нет ли телефона у пользователя (для всех способов входа)
                                if (user && !user.phone) {
                                    // Проверяем, не показывали ли мы уже это предложение
                                    const hasSeenPrompt = localStorage.getItem('whatsapp_prompt_seen') === 'true';
                                    if (!hasSeenPrompt) {
                                        console.log('[callback] User without phone, showing WhatsApp prompt');
                                        setShowWhatsAppPrompt(true);
                                        setStatus('success');
                                        return;
                                    }
                                }
                                
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
                        
                        // Проверяем, нет ли телефона у пользователя (для всех способов входа)
                        if (user && !user.phone) {
                            // Проверяем, не показывали ли мы уже это предложение
                            const hasSeenPrompt = localStorage.getItem('whatsapp_prompt_seen') === 'true';
                            if (!hasSeenPrompt) {
                                console.log('[callback] User without phone, showing WhatsApp prompt');
                                setShowWhatsAppPrompt(true);
                                setStatus('success');
                                return;
                            }
                        }
                        
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

    if (showWhatsAppPrompt) {
        return (
            <>
                <FullScreenStatus
                    title="Авторизация завершена"
                    subtitle="Настройте уведомления"
                    message=""
                    loading={false}
                />
                <WhatsAppConnectPrompt
                    onDismiss={() => {
                        // Помечаем, что пользователь видел предложение
                        localStorage.setItem('whatsapp_prompt_seen', 'true');
                        setShowWhatsAppPrompt(false);
                        // Редиректим после закрытия
                        (async () => {
                            const { data: { user } } = await supabase.auth.getUser();
                            const nextParam = searchParams.get('next');
                            const targetPath = await decideRedirect(nextParam || '/', user?.id);
                            router.refresh();
                            await new Promise(resolve => setTimeout(resolve, 100));
                            window.location.href = targetPath;
                        })();
                    }}
                    onSuccess={() => {
                        // Помечаем, что пользователь подключил WhatsApp
                        localStorage.setItem('whatsapp_prompt_seen', 'true');
                        setShowWhatsAppPrompt(false);
                        // Редиректим после успешного подключения
                        (async () => {
                            const { data: { user } } = await supabase.auth.getUser();
                            const nextParam = searchParams.get('next');
                            const targetPath = await decideRedirect(nextParam || '/', user?.id);
                            router.refresh();
                            await new Promise(resolve => setTimeout(resolve, 100));
                            window.location.href = targetPath;
                        })();
                    }}
                />
            </>
        );
    }

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

