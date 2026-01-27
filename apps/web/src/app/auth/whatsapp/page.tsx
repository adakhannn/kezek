// apps/web/src/app/auth/whatsapp/page.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

function WhatsAppAuthContent() {
    const router = useRouter();
    const sp = useSearchParams();
    const redirect = sp.get('redirect') || '/';

    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(0);

    // Таймер для повторной отправки
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    async function handleSendOtp(e?: React.FormEvent) {
        e?.preventDefault();
        setSending(true);
        setError(null);

        try {
            const response = await fetch('/api/auth/whatsapp/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
            });

            const data = await response.json();

            if (!data.ok) {
                throw new Error(data.message || 'Не удалось отправить код');
            }

            setStep('otp');
            setCountdown(60); // 60 секунд до возможности повторной отправки
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSending(false);
        }
    }

    async function handleVerifyOtp(e: React.FormEvent) {
        e.preventDefault();
        setVerifying(true);
        setError(null);

        try {
            const response = await fetch('/api/auth/whatsapp/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, code: otp }),
            });

            const data = await response.json();

            if (!data.ok) {
                throw new Error(data.message || 'Неверный код');
            }

            // После проверки OTP через WhatsApp создаем сессию через API
            // Используем специальный endpoint для создания сессии после WhatsApp OTP
            const { normalizePhoneToE164 } = await import('@/lib/senders/sms');
            const normalizedPhone = normalizePhoneToE164(phone);
            
            if (!normalizedPhone) {
                throw new Error('Неверный формат номера телефона');
            }
            
            const sessionResponse = await fetch('/api/auth/whatsapp/create-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    phone: normalizedPhone,
                    userId: data.userId,
                    redirect: redirect,
                }),
            });
            
            const sessionData = await sessionResponse.json();
            
            if (!sessionData.ok) {
                console.error('[whatsapp] Failed to create session:', sessionData);
                setError(sessionData.message || 'Не удалось создать сессию');
                return;
            }
            
            const { supabase } = await import('@/lib/supabaseClient');
            
            // Если есть готовые токены, используем их
            if (sessionData.session?.access_token && sessionData.session?.refresh_token) {
                console.log('[whatsapp] Setting session with tokens');
                const { data: sessionResult, error: sessionError } = await supabase.auth.setSession({
                    access_token: sessionData.session.access_token,
                    refresh_token: sessionData.session.refresh_token,
                });
                
                if (sessionError) {
                    console.error('[whatsapp] Failed to set session:', sessionError);
                    setError('Не удалось установить сессию: ' + sessionError.message);
                    return;
                }
                
                // Проверяем, что сессия действительно установлена
                const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
                if (userError || !currentUser) {
                    console.error('[whatsapp] Session set but user not found:', userError);
                    setError('Сессия не была создана. Попробуйте еще раз.');
                    return;
                }
                
                console.log('[whatsapp] Session created successfully, user:', currentUser.id);
                
                // Сессия создана успешно
                router.refresh();
                router.push(redirect);
                return;
            }
            
            // Если нужно войти через email и пароль
            if (sessionData.email && sessionData.password && sessionData.needsSignIn) {
                console.log('[whatsapp] Signing in with email and password');
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: sessionData.email,
                    password: sessionData.password,
                });
                
                if (signInError) {
                    console.error('[whatsapp] Failed to sign in:', signInError);
                    setError('Не удалось войти: ' + signInError.message);
                    return;
                }
                
                // Проверяем, что сессия создана
                const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
                if (userError || !currentUser) {
                    console.error('[whatsapp] Sign in successful but user not found:', userError);
                    setError('Вход выполнен, но сессия не была создана. Попробуйте еще раз.');
                    return;
                }
                
                console.log('[whatsapp] Sign in successful, user:', currentUser.id);
                
                // Сессия создана успешно
                router.refresh();
                router.push(redirect);
                return;
            }
            
            // Если есть magic link, переходим по нему
            if (sessionData.magicLink) {
                console.log('[whatsapp] Redirecting to magic link:', sessionData.magicLink);
                // Переходим по magic link - Supabase создаст сессию автоматически
                window.location.href = sessionData.magicLink;
                return;
            }
            
            // Если ничего не сработало, показываем ошибку
            console.error('[whatsapp] No valid session data received:', sessionData);
            setError('Не удалось создать сессию. Попробуйте еще раз.');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setVerifying(false);
        }
    }

    async function handleResendOtp() {
        if (countdown > 0) return;
        await handleSendOtp();
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        Вход через WhatsApp
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        {step === 'phone'
                            ? 'Введите номер телефона для получения кода'
                            : 'Введите код, отправленный на WhatsApp'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                {step === 'phone' ? (
                    <form onSubmit={handleSendOtp} className="mt-8 space-y-6">
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Номер телефона
                            </label>
                            <input
                                id="phone"
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+996500574029"
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                            />
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={sending}
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? 'Отправка...' : 'Отправить код'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="mt-8 space-y-6">
                        <div>
                            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Код подтверждения
                            </label>
                            <input
                                id="otp"
                                type="text"
                                required
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-700 text-center text-2xl tracking-widest"
                            />
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                Код отправлен на {phone}
                            </p>
                        </div>

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setStep('phone')}
                                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                            >
                                Изменить номер
                            </button>
                            <button
                                type="button"
                                onClick={handleResendOtp}
                                disabled={countdown > 0}
                                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {countdown > 0 ? `Отправить снова (${countdown}с)` : 'Отправить код снова'}
                            </button>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={verifying || otp.length !== 6}
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {verifying ? 'Проверка...' : 'Войти'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="text-center">
                    <button
                        onClick={() => router.push('/auth/sign-in')}
                        className="text-sm text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                        Вернуться к другим способам входа
                    </button>
                </div>
            </div>
        </main>
    );
}

export default function WhatsAppAuthPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Загрузка...</p>
                    </div>
                </div>
            </main>
        }>
            <WhatsAppAuthContent />
        </Suspense>
    );
}

