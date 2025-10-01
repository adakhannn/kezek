'use client';
import Link from 'next/link';
import {useState} from 'react';

import {supabase} from '@/lib/supabaseClient';

export default function SignUpPage() {
    const [mode, setMode] = useState<'email' | 'phone'>('email');

    // email
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [fullName, setFullName] = useState('');

    // phone
    const [phone, setPhone] = useState('');
    const [phonePass, setPhonePass] = useState(''); // Supabase требует пароль при регистрации по телефону

    async function signUpEmail() {
        const {error} = await supabase.auth.signUp({
            email,
            password: pass,
            options: {data: {full_name: fullName}},
        });
        if (error) return alert(error.message);
        alert('Проверьте почту для подтверждения (если включено)');
        location.href = '/';
    }

    async function signUpPhone() {
        const {error} = await supabase.auth.signUp({
            phone,
            password: phonePass, // обязателен при signUp с телефоном
            options: {data: {full_name: fullName}},
        });
        if (error) return alert(error.message);
        location.href = `/auth/verify-otp?phone=${encodeURIComponent(phone)}`;
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2 text-sm">
                <button className={`border px-3 py-1 rounded ${mode === 'email' ? 'bg-white/10' : ''}`}
                        onClick={() => setMode('email')}>По e-mail
                </button>
                <button className={`border px-3 py-1 rounded ${mode === 'phone' ? 'bg-white/10' : ''}`}
                        onClick={() => setMode('phone')}>По телефону
                </button>
            </div>

            {mode === 'email' ? (
                <div className="space-y-2">
                    <input className="w-full border rounded px-2 py-1" placeholder="Имя"
                           value={fullName} onChange={e => setFullName(e.target.value)}/>
                    <input className="w-full border rounded px-2 py-1" placeholder="email"
                           value={email} onChange={e => setEmail(e.target.value)}/>
                    <input className="w-full border rounded px-2 py-1" placeholder="пароль" type="password"
                           value={pass} onChange={e => setPass(e.target.value)}/>
                    <button className="border px-3 py-1 rounded w-full" onClick={signUpEmail}>Зарегистрироваться
                    </button>
                    <div className="text-sm text-gray-400">
                        Уже есть аккаунт? <Link className="underline" href="/auth/sign-in">Войти</Link>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <input className="w-full border rounded px-2 py-1" placeholder="Имя"
                           value={fullName} onChange={e => setFullName(e.target.value)}/>
                    <input className="w-full border rounded px-2 py-1" placeholder="+996XXXXXXXXX"
                           value={phone} onChange={e => setPhone(e.target.value)}/>
                    <input className="w-full border rounded px-2 py-1" placeholder="пароль" type="password"
                           value={phonePass} onChange={e => setPhonePass(e.target.value)}/>
                    <button className="border px-3 py-1 rounded w-full" onClick={signUpPhone}>Зарегистрироваться
                    </button>
                    <div className="text-sm text-gray-400">
                        Уже есть аккаунт? <Link className="underline" href="/auth/sign-in">Войти</Link>
                    </div>
                </div>
            )}
        </div>
    );
}
