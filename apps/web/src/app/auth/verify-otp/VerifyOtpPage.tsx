// apps/web/src/app/auth/verify-otp/page.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function VerifyOtpPage() {
    const router = useRouter();
    const sp = useSearchParams();
    const phone = useMemo(() => sp.get('phone') ?? '', [sp]);
    const fromWhatsApp = useMemo(() => sp.get('from') === 'whatsapp-setup', [sp]);
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!phone) {
            // если пришли без телефона — вернём на ввод
            location.replace('/auth/sign-in');
        }
    }, [phone]);

    async function verify() {
        if (!token.trim()) {
            alert('Введите код из SMS');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                phone,
                token,
                type: 'sms', // важно: тип должен быть 'sms' для проверки кода
            });
            if (error) throw error;

            // Обновляем серверные компоненты перед редиректом
            router.refresh();
            
            // Если это было подключение WhatsApp, обновляем телефон пользователя
            if (fromWhatsApp) {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        // Телефон уже подтвержден через OTP, просто обновляем профиль
                        await fetch('/api/user/update-phone', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ phone }),
                        });
                    }
                } catch (e) {
                    console.warn('Failed to update phone after OTP verification:', e);
                }
            }
            
            // Успех — на главную (или обратно на ожидаемую страницу)
            router.push('/');
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-800 space-y-6">
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-2xl mb-4 shadow-lg">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Подтверждение телефона</h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Мы отправили SMS на: <span className="font-semibold text-gray-900 dark:text-gray-100">{phone}</span>
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Код подтверждения
                            </label>
                            <input
                                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-center text-2xl font-mono tracking-widest"
                                placeholder="000000"
                                value={token}
                                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                inputMode="numeric"
                                maxLength={6}
                                autoFocus
                            />
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">Введите 6-значный код из SMS</p>
                        </div>

                        <button
                            className="w-full px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            onClick={verify}
                            disabled={loading || token.length !== 6}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Проверяю...
                                </>
                            ) : (
                                <>
                                    Подтвердить
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
