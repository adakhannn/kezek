'use client';
import Link from 'next/link';
import {useState} from 'react';

import {supabase} from '@/lib/supabaseClient';

export default function SignInPage() {
    const [mode, setMode] = useState<'email' | 'phone'>('email');

    // email/pass
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');

    // phone
    const [phone, setPhone] = useState(''); // в формате +996XXXXXXXXX

    async function signInEmail() {
        const {error} = await supabase.auth.signInWithPassword({email, password: pass});
        if (error) return alert(error.message);
        location.href = '/';
    }

    async function signInPhone() {
        // отправляем OTP по SMS
        const {error} = await supabase.auth.signInWithOtp({
            phone,
            options: {channel: 'sms'},
        });
        if (error) return alert(error.message);
        location.href = `/auth/verify-otp?phone=${encodeURIComponent(phone)}`;
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2 text-sm">
                <button
                    className={`border px-3 py-1 rounded ${mode === 'email' ? 'bg-white/10' : ''}`}
                    onClick={() => setMode('email')}
                >
                    По e-mail
                </button>
                <button
                    className={`border px-3 py-1 rounded ${mode === 'phone' ? 'bg-white/10' : ''}`}
                    onClick={() => setMode('phone')}
                >
                    По телефону (SMS)
                </button>
            </div>

            {mode === 'email' ? (
                <div className="space-y-2">
                    <input className="w-full border rounded px-2 py-1" placeholder="email"
                           value={email} onChange={e => setEmail(e.target.value)}/>
                    <input className="w-full border rounded px-2 py-1" placeholder="пароль" type="password"
                           value={pass} onChange={e => setPass(e.target.value)}/>
                    <button className="border px-3 py-1 rounded w-full" onClick={signInEmail}>Войти</button>
                    <div className="text-sm text-gray-400">
                        Нет аккаунта? <Link className="underline" href="/auth/sign-up">Регистрация</Link><br/>
                        Забыли пароль? <Link className="underline" href="/auth/reset-password">Сбросить</Link>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <input className="w-full border rounded px-2 py-1" placeholder="+996XXXXXXXXX"
                           value={phone} onChange={e => setPhone(e.target.value)}/>
                    <button className="border px-3 py-1 rounded w-full" onClick={signInPhone}>
                        Получить код в SMS
                    </button>
                    <div className="text-sm text-gray-400">
                        Нет аккаунта? <Link className="underline" href="/auth/sign-up">Регистрация</Link>
                    </div>
                </div>
            )}
        </div>
    );
}
