// apps/web/src/app/auth/verify/page.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'phone' | 'email';

export default function VerifyPage() {
    const sp = useSearchParams();
    const router = useRouter();

    const mode: Mode = (sp.get('mode') as Mode) || 'phone';
    const phone = sp.get('phone') || '';
    const email = sp.get('email') || '';
    const redirect = sp.get('redirect') || '/';

    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchIsSuper = useCallback(async (): Promise<boolean> => {
        const { data, error } = await supabase.rpc('is_super_admin');
        if (error) {
            console.warn('is_super_admin error:', error.message);
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
            console.warn('owner check error:', error.message);
            return false;
        }
        return (count ?? 0) > 0;
    }, []);

    const decideAndGo = useCallback(
        async (fallback: string) => {
            const { data } = await supabase.auth.getUser();
            const uid = data.user?.id;

            if (await fetchIsSuper()) {
                router.replace('/admin');
                return;
            }
            if (await fetchOwnsBusiness(uid)) {
                router.replace('/dashboard');
                return;
            }
            router.replace(fallback || '/');
        },
        [fetchIsSuper, fetchOwnsBusiness, router]
    );

    async function verify(e: React.FormEvent) {
        e.preventDefault();
        setVerifying(true);
        setError(null);
        try {
            if (mode === 'phone') {
                if (!phone) throw new Error('Не передан номер телефона');
                const { error } = await supabase.auth.verifyOtp({
                    phone,
                    token: code.trim(),
                    type: 'sms',
                });
                if (error) throw error;
            } else {
                if (!email) throw new Error('Не передан e-mail');
                const { error } = await supabase.auth.verifyOtp({
                    email,
                    token: code.trim(),
                    type: 'email',
                });
                if (error) throw error;
            }

            // Обновляем серверные компоненты перед редиректом
            router.refresh();
            // Решаем редирект по ролям/владению бизнесом
            await decideAndGo(redirect);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setVerifying(false);
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-indigo-950 dark:via-gray-900 dark:to-pink-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-8 space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Подтверждение</h1>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Мы отправили код на {mode === 'phone' ? <b className="text-gray-900 dark:text-gray-100">{phone}</b> : <b className="text-gray-900 dark:text-gray-100">{email}</b>}
                    </div>
                </div>

                <form onSubmit={verify} className="space-y-4">
                    <Input
                        placeholder="Код из сообщения"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        inputMode="numeric"
                        required
                        className="text-center text-2xl tracking-widest"
                    />
                    {!!error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                        </div>
                    )}
                    <Button
                        type="submit"
                        disabled={verifying}
                        isLoading={verifying}
                        className="w-full"
                    >
                        Подтвердить
                    </Button>
                </form>
            </div>
        </main>
    );
}
