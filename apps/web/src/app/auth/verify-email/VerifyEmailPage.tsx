'use client';

import {useRouter, useSearchParams} from 'next/navigation';
import {useState} from 'react';

import {supabase} from '@/lib/supabaseClient';

export default function VerifyEmailPage() {
    const sp = useSearchParams();
    const router = useRouter();
    const email = sp.get('email') || '';
    const redirect = sp.get('redirect') || '/';

    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function verify(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setVerifying(true);
        try {
            const {error} = await supabase.auth.verifyOtp({
                email,
                token: code,
                type: 'email', // важно: проверяем e-mail OTP
            });
            if (error) throw error;
            router.replace(redirect);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setVerifying(false);
        }
    }

    return (
        <main className="mx-auto max-w-sm p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Подтверждение e-mail</h1>
            <div className="text-sm text-gray-600">
                Мы отправили код на: <b>{email}</b>
            </div>
            <form onSubmit={verify} className="space-y-3">
                <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="Код из письма"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    required
                />
                <button className="w-full border rounded px-3 py-2 disabled:opacity-50" disabled={verifying}
                        type="submit">
                    {verifying ? 'Проверяю…' : 'Подтвердить'}
                </button>
            </form>
            {error && <div className="text-red-600 text-sm">{error}</div>}
        </main>
    );
}
