// apps/web/src/app/auth/verify/page.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

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

            // Решаем редирект по ролям/владению бизнесом
            await decideAndGo(redirect);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setVerifying(false);
        }
    }

    return (
        <main className="mx-auto max-w-sm p-6 space-y-4">
            <h1 className="text-xl font-semibold">Подтверждение</h1>
            <div className="text-sm text-gray-600">
                Мы отправили код на {mode === 'phone' ? <b>{phone}</b> : <b>{email}</b>}
            </div>

            <form onSubmit={verify} className="space-y-3">
                <input
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Код из сообщения"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    required
                />
                <button
                    className="border rounded px-3 py-2 w-full disabled:opacity-50"
                    disabled={verifying}
                    type="submit"
                >
                    Подтвердить
                </button>
                {!!error && <div className="text-red-600 text-sm">{error}</div>}
            </form>
        </main>
    );
}
