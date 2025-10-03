'use client';

import {useSearchParams, useRouter} from 'next/navigation';
import {useState} from 'react';

import {supabase} from '@/lib/supabaseClient';

type Mode = 'phone' | 'email';

export default function VerifyPage() {
    const sp = useSearchParams();
    const router = useRouter();

    const mode = (sp.get('mode') as Mode) || 'phone';
    const phone = sp.get('phone') || '';
    const email = sp.get('email') || '';
    const redirect = sp.get('redirect') || '/';

    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function verify(e: React.FormEvent) {
        e.preventDefault();
        setVerifying(true);
        setError(null);
        try {
            if (mode === 'phone') {
                const {error} = await supabase.auth.verifyOtp({
                    phone,
                    token: code,
                    type: 'sms',
                });
                if (error) throw error;
            } else {
                const {error} = await supabase.auth.verifyOtp({
                    email,
                    token: code,
                    type: 'email', // важно: тип 'email' для Email OTP
                });
                if (error) throw error;
            }
            router.replace(redirect);
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
                <button className="border rounded px-3 py-2 w-full disabled:opacity-50" disabled={verifying}
                        type="submit">
                    Подтвердить
                </button>
                {!!error && <div className="text-red-600 text-sm">{error}</div>}
            </form>
        </main>
    );
}
