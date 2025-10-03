'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function SignInPage() {
    const sp = useSearchParams();
    const router = useRouter();
    const redirect = sp.get('redirect') || '/';
    const [mode, setMode] = useState<'email' | 'phone'>('email');

    // email
    const [email, setEmail] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailMsg, setEmailMsg] = useState<string | null>(null);
    const [emailErr, setEmailErr] = useState<string | null>(null);

    // phone (оставляем как было — SMS OTP без пароля)
    const [phone, setPhone] = useState('');
    const [sendingSms, setSendingSms] = useState(false);
    const [smsErr, setSmsErr] = useState<string | null>(null);

    // если уже вошёл — сразу редиректим
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) router.replace(redirect);
        });
    }, [redirect, router]);

    async function sendMagicLink(e: React.FormEvent) {
        e.preventDefault();
        setSendingEmail(true);
        setEmailErr(null);
        setEmailMsg(null);
        try {
            // редирект для магик-линка: попадём на /auth/callback,
            // где обменяем code+state на сессию и утащим пользователя на redirect
            const emailRedirectTo =
                (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_ORIGIN || '') +
                `/auth/callback?redirect=${encodeURIComponent(redirect)}`;

            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: true, emailRedirectTo },
            });
            if (error) throw error;
            setEmailMsg('Мы отправили письмо со ссылкой для входа. Проверьте почту.');
        } catch (err) {
            setEmailErr(err instanceof Error ? err.message : String(err));
        } finally {
            setSendingEmail(false);
        }
    }

    async function sendSmsCode(e: React.FormEvent) {
        e.preventDefault();
        setSendingSms(true);
        setSmsErr(null);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                phone,
                options: { channel: 'sms' },
            });
            if (error) throw error;
            router.push(`/auth/verify?phone=${encodeURIComponent(phone)}&redirect=${encodeURIComponent(redirect)}`);
        } catch (err) {
            setSmsErr(err instanceof Error ? err.message : String(err));
        } finally {
            setSendingSms(false);
        }
    }

    return (
        <main className="mx-auto max-w-sm p-6 space-y-6">
            <h1 className="text-xl font-semibold">Войти</h1>

            <div className="flex gap-2 text-sm">
                <button
                    className={`border px-3 py-1 rounded ${mode === 'email' ? 'bg-gray-100' : ''}`}
                    onClick={() => setMode('email')}
                    type="button"
                >
                    По e-mail (magic link)
                </button>
                <button
                    className={`border px-3 py-1 rounded ${mode === 'phone' ? 'bg-gray-100' : ''}`}
                    onClick={() => setMode('phone')}
                    type="button"
                >
                    По телефону (SMS)
                </button>
            </div>

            {mode === 'email' ? (
                <form onSubmit={sendMagicLink} className="space-y-3">
                    <label className="block text-sm">E-mail</label>
                    <input
                        className="border rounded px-3 py-2 w-full"
                        placeholder="you@example.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <button
                        className="border rounded px-3 py-2 w-full disabled:opacity-50"
                        disabled={sendingEmail}
                        type="submit"
                    >
                        {sendingEmail ? 'Отправляю…' : 'Отправить magic-link'}
                    </button>
                    {emailMsg && <div className="text-green-700 text-sm">{emailMsg}</div>}
                    {emailErr && <div className="text-red-600 text-sm">{emailErr}</div>}
                </form>
            ) : (
                <form onSubmit={sendSmsCode} className="space-y-3">
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
                        disabled={sendingSms}
                        type="submit"
                    >
                        Отправить код по SMS
                    </button>
                    {smsErr && <div className="text-red-600 text-sm">{smsErr}</div>}
                </form>
            )}
        </main>
    );
}


