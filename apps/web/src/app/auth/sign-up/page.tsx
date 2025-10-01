'use client';
import Link from 'next/link';
import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function SignUpPage() {
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [pass, setPass] = useState('');
    const [email, setEmail] = useState('');

    async function signUp() {
        if (!phone) {
            alert('Телефон обязателен');
            return;
        }

        const { error } = await supabase.auth.signUp({
            phone,
            password: pass || Math.random().toString(36).slice(-10), // fallback пароль
            options: {
                data: {
                    full_name: fullName,
                    email: email || null, // опционально
                },
            },
        });

        if (error) return alert(error.message);

        // Supabase пошлёт SMS с OTP
        location.href = `/auth/verify-otp?phone=${encodeURIComponent(phone)}`;
    }

    return (
        <div className="space-y-4 max-w-sm mx-auto">
            <h1 className="text-xl font-semibold">Регистрация</h1>
            <input
                className="w-full border rounded px-2 py-1"
                placeholder="Имя"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
            />
            <input
                className="w-full border rounded px-2 py-1"
                placeholder="+996XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
            />
            <input
                className="w-full border rounded px-2 py-1"
                placeholder="Пароль (временно)"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
            />
            <input
                className="w-full border rounded px-2 py-1"
                placeholder="E-mail (необязательно)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <button
                className="border px-3 py-1 rounded w-full"
                onClick={signUp}
            >
                Зарегистрироваться
            </button>

            <div className="text-sm text-gray-400">
                Уже есть аккаунт?{' '}
                <Link className="underline" href="/auth/sign-in">
                    Войти
                </Link>
            </div>
        </div>
    );
}
