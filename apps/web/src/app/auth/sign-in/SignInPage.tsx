'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function SignInPage() {
    const sp = useSearchParams();
    const router = useRouter();
    const redirect = sp.get('redirect') || '/';

    const [phone, setPhone] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // если уже вошёл — сразу редиректим
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) router.replace(redirect);
        });
    }, [redirect, router]);

    async function sendCode(e: React.FormEvent) {
        e.preventDefault();
        setSending(true);
        setError(null);
        try {
            // ВАЖНО: телефон в E.164, например +996555123456
            const { error } = await supabase.auth.signInWithOtp({
                phone,
                options: { channel: 'sms' },
            });
            if (error) throw error;
            // на страницу ввода кода
            router.push(`/auth/verify?phone=${encodeURIComponent(phone)}&redirect=${encodeURIComponent(redirect)}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSending(false);
        }
    }

    return (
        <form onSubmit={sendCode} className="space-y-3">
            <label className="block text-sm">Телефон (в формате +996…)</label>
            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="+996555123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
            />
            <button
                className="border rounded px-3 py-2 w-full disabled:opacity-50"
                disabled={sending}
                type="submit"
            >
                Отправить код по SMS
            </button>

            <div className="text-xs text-gray-500">
                Ввод телефона означает согласие с обработкой персональных данных.
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
        </form>
    );
}