// apps/web/src/app/auth/verify-otp/page.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

export default function VerifyOtpPage() {
    const router = useRouter();
    const sp = useSearchParams();
    const phone = useMemo(() => sp.get('phone') ?? '', [sp]);
    const fromWhatsApp = useMemo(() => sp.get('from') === 'whatsapp-setup', [sp]);
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (!phone) {
            location.replace('/auth/sign-in');
        }
    }, [phone]);

    async function verify() {
        if (!token.trim()) {
            toast.showError('Введите код из SMS');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                phone,
                token,
                type: 'sms',
            });
            if (error) throw error;

            router.refresh();

            if (fromWhatsApp) {
                try {
                    const {
                        data: { user },
                    } = await supabase.auth.getUser();
                    if (user) {
                        await fetch('/api/user/update-phone', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ phone }),
                        });
                    }
                } catch (e) {
                    logWarn('VerifyOtp', 'Failed to update phone after OTP verification', e);
                }
            }

            router.push('/');
        } catch (e) {
            toast.showError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="w-full max-w-md">
                <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900">
                    <div className="space-y-2 text-center">
                        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-pink-600 shadow-lg">
                            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Подтверждение телефона</h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Мы отправили SMS на:{' '}
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{phone}</span>
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Код подтверждения
                            </label>
                            <input
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-center text-2xl font-mono tracking-widest text-gray-900 placeholder:text-gray-400 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                                placeholder="000000"
                                value={token}
                                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                inputMode="numeric"
                                maxLength={6}
                                autoFocus
                            />
                            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                                Введите 6-значный код из SMS
                            </p>
                        </div>

                        <button
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-pink-600 px-6 py-3.5 font-bold text-white shadow-md transition-all duration-200 hover:from-indigo-700 hover:to-pink-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={verify}
                            disabled={loading || token.length !== 6}
                        >
                            {loading ? (
                                <>
                                    <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Проверяю...
                                </>
                            ) : (
                                <>
                                    Подтвердить
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </main>
    );
}

