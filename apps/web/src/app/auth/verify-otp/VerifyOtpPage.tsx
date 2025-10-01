// apps/web/src/app/auth/verify-otp/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function VerifyOtpPage() {
    const sp = useSearchParams();
    const phone = useMemo(() => sp.get('phone') ?? '', [sp]);
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

            // Успех — на главную (или обратно на ожидаемую страницу)
            location.href = '/';
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="mx-auto max-w-sm p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Подтверждение телефона</h1>
            <div className="text-sm text-gray-600">Мы отправили SMS на: <b>{phone}</b></div>
            <input
                className="w-full border rounded px-3 py-2"
                placeholder="Код из SMS"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                inputMode="numeric"
            />
            <button
                className="w-full border rounded px-3 py-2 disabled:opacity-50"
                onClick={verify}
                disabled={loading}
            >
                {loading ? 'Проверяю…' : 'Подтвердить'}
            </button>
        </main>
    );
}
