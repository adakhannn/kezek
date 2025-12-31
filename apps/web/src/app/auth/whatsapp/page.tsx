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

    async function handleSendOtp(e: React.FormEvent) {
        e.preventDefault();
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

            // После проверки OTP через WhatsApp используем стандартный Supabase phone auth
            // для создания сессии. Отправляем OTP через Supabase и сразу проверяем его
            const { supabase } = await import('@/lib/supabaseClient');
            const { normalizePhoneToE164 } = await import('@/lib/senders/sms');
            const normalizedPhone = normalizePhoneToE164(phone);
            
            if (!normalizedPhone) {
                throw new Error('Неверный формат номера телефона');
            }
            
            // Отправляем OTP через Supabase (это создаст запрос на отправку SMS, но мы уже отправили через WhatsApp)
            // Затем сразу проверяем OTP с тем же кодом
            const { error: otpError } = await supabase.auth.signInWithOtp({
                phone: normalizedPhone,
                options: {
                    channel: 'sms',
                    shouldCreateUser: data.isNewUser,
                },
            });
            
            // Игнорируем ошибку "already registered", так как пользователь уже существует
            if (otpError && !otpError.message.includes('already registered') && !otpError.message.includes('already exists')) {
                console.warn('[whatsapp] signInWithOtp warning:', otpError);
                // Продолжаем, даже если есть ошибка
            }
            
            // Сразу проверяем OTP с тем же кодом, который мы уже проверили через WhatsApp
            // Supabase должен принять этот код, так как мы только что отправили запрос
            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
                phone: normalizedPhone,
                token: otp,
                type: 'sms',
            });
            
            if (verifyError) {
                console.error('[whatsapp] verifyOtp error:', verifyError);
                // Если не удалось создать сессию, перенаправляем на страницу входа
                router.push(`/auth/sign-in?phone=${encodeURIComponent(phone)}&whatsapp_verified=true&redirect=${encodeURIComponent(redirect)}`);
                return;
            }
            
            // Сессия создана успешно
            router.refresh();
            router.push(redirect);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setVerifying(false);
        }
    }

    async function handleResendOtp() {
        if (countdown > 0) return;
        await handleSendOtp(new Event('submit') as unknown as React.FormEvent);
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

