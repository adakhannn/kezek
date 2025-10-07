'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

type Mode = 'phone' | 'email';

export default function SignInPage() {
    const sp = useSearchParams();
    const router = useRouter();
    const redirect = sp.get('redirect') || '/';

    const initialMode = (sp.get('mode') as Mode) ?? 'phone';
    const [mode, setMode] = useState<Mode>(initialMode);

    // phone (OTP)
    const [phone, setPhone] = useState('');
    const [sending, setSending] = useState(false);

    // email+password
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [loadingEmail, setLoadingEmail] = useState(false);

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
            const { error } = await supabase.auth.signInWithOtp({
                phone,
                options: { channel: 'sms' },
            });
            if (error) throw error;
            router.push(
                `/auth/verify?phone=${encodeURIComponent(phone)}&redirect=${encodeURIComponent(
                    redirect,
                )}`,
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSending(false);
        }
    }

    async function signInEmail(e: React.FormEvent) {
        e.preventDefault();
        setLoadingEmail(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password: pass,
            });
            if (error) throw error;
            router.replace(redirect);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoadingEmail(false);
        }
    }

    return (
        <main className="mx-auto max-w-sm p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Вход</h1>

            {/* tabs */}
            <div className="flex gap-2 text-sm">
                <button
                    type="button"
                    className={`border px-3 py-1 rounded ${mode === 'phone' ? 'bg-white/10' : ''}`}
                    onClick={() => setMode('phone')}
                >
                    По телефону (SMS)
                </button>
                <button
                    type="button"
                    className={`border px-3 py-1 rounded ${mode === 'email' ? 'bg-white/10' : ''}`}
                    onClick={() => setMode('email')}
                >
                    По e-mail + пароль
                </button>
            </div>

            {mode === 'phone' ? (
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
                        {sending ? 'Отправляю…' : 'Отправить код по SMS'}
                    </button>
                </form>
            ) : (
                <form onSubmit={signInEmail} className="space-y-3">
                    <input
                        className="border rounded px-3 py-2 w-full"
                        placeholder="E-mail"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        className="border rounded px-3 py-2 w-full"
                        placeholder="Пароль"
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        required
                    />
                    <button
                        className="border rounded px-3 py-2 w-full disabled:opacity-50"
                        disabled={loadingEmail}
                        type="submit"
                    >
                        {loadingEmail ? 'Вхожу…' : 'Войти'}
                    </button>
                </form>
            )}

            {error && <div className="text-red-600 text-sm">{error}</div>}

            <div className="text-xs text-gray-500">
                Нет аккаунта? <a className="underline" href="/auth/sign-up">Зарегистрируйтесь</a>
            </div>
        </main>
    );
}
