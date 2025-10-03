'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';

import {supabase} from '@/lib/supabaseClient';

type Mode = 'phone' | 'email';

export default function SignUpPage() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>('phone');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function sendOtp(e: React.FormEvent) {
        e.preventDefault();
        setSending(true);
        setError(null);
        try {
            if (mode === 'phone') {
                const {error} = await supabase.auth.signInWithOtp({phone, options: {channel: 'sms'}});
                if (error) throw error;
                // имя сохраним после верификации: /auth/post-signup обновит metadata
                localStorage.setItem('signup_full_name', fullName);
                router.push(`/auth/verify?mode=phone&phone=${encodeURIComponent(phone)}&redirect=/auth/post-signup`);
            } else {
                const {error} = await supabase.auth.signInWithOtp({email});
                if (error) throw error;
                localStorage.setItem('signup_full_name', fullName);
                router.push(`/auth/verify?mode=email&email=${encodeURIComponent(email)}&redirect=/auth/post-signup`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSending(false);
        }
    }

    return (
        <main className="mx-auto max-w-sm p-6 space-y-4">
            <h1 className="text-xl font-semibold">Регистрация</h1>

            <div className="flex gap-2">
                <button className={`border px-3 py-1 rounded ${mode === 'phone' ? 'bg-white/10' : ''}`}
                        onClick={() => setMode('phone')}>По телефону
                </button>
                <button className={`border px-3 py-1 rounded ${mode === 'email' ? 'bg-white/10' : ''}`}
                        onClick={() => setMode('email')}>По e-mail
                </button>
            </div>

            <form onSubmit={sendOtp} className="space-y-3">
                <input className="border rounded px-3 py-2 w-full" placeholder="Имя" value={fullName}
                       onChange={e => setFullName(e.target.value)}/>
                {mode === 'phone' ? (
                    <input className="border rounded px-3 py-2 w-full" placeholder="+996555123456" value={phone}
                           onChange={e => setPhone(e.target.value)} required/>
                ) : (
                    <input className="border rounded px-3 py-2 w-full" type="email" placeholder="you@example.com"
                           value={email} onChange={e => setEmail(e.target.value)} required/>
                )}
                <button className="border rounded px-3 py-2 w-full disabled:opacity-50" disabled={sending}
                        type="submit">
                    Отправить код
                </button>
                {!!error && <div className="text-red-600 text-sm">{error}</div>}
            </form>
        </main>
    );
}

