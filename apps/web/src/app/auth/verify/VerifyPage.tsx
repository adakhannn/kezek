'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function VerifyPage() {
    const sp = useSearchParams();
    const router = useRouter();
    const phone = sp.get('phone') || '';
    const redirect = sp.get('redirect') || '/';

    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function verify(e: React.FormEvent) {
        e.preventDefault();
        setVerifying(true);
        setError(null);
        try {
            const { error } = await supabase.auth.verifyOtp({
                phone,
                token: code,
                type: 'sms',
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
        <form onSubmit={verify} className="space-y-3">
            <div className="text-sm">Мы отправили код на номер <b>{phone}</b></div>
            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Код из SMS"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                required
            />
            <button className="border rounded px-3 py-2 w-full disabled:opacity-50" disabled={verifying} type="submit">
                Подтвердить
            </button>
            {error && <div className="text-red-600 text-sm">{error}</div>}
        </form>
    );
}