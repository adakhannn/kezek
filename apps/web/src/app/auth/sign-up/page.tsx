'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {normalizePhoneToE164} from '@/lib/senders/sms';
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
                // Нормализуем телефон в формат E.164
                const phoneNormalized = normalizePhoneToE164(phone.trim());
                if (!phoneNormalized) {
                    throw new Error('Некорректный номер телефона');
                }
                
                const {error} = await supabase.auth.signInWithOtp({
                    phone: phoneNormalized, 
                    options: {
                        channel: 'sms',
                        shouldCreateUser: true
                    }
                });
                if (error) throw error;
                // имя сохраним после верификации: /auth/post-signup обновит metadata
                localStorage.setItem('signup_full_name', fullName);
                router.push(`/auth/verify?mode=phone&phone=${encodeURIComponent(phoneNormalized)}&redirect=/auth/post-signup`);
            } else {
                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        shouldCreateUser: true,
                        emailRedirectTo: `${location.origin}/auth/callback`,
                    },
                });
                if (error) throw error;
                localStorage.setItem('signup_full_name', fullName);
                router.push('/auth/verify-email');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSending(false);
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-indigo-950 dark:via-gray-900 dark:to-pink-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-8 space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Регистрация</h1>
                    <p className="text-gray-600 dark:text-gray-400">Создайте аккаунт для записи</p>
                </div>

                <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            mode === 'phone'
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                                : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setMode('phone')}
                        type="button"
                    >
                        По телефону
                    </button>
                    <button
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            mode === 'email'
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                                : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setMode('email')}
                        type="button"
                    >
                        По e-mail
                    </button>
                </div>

                <form onSubmit={sendOtp} className="space-y-4">
                    <Input
                        placeholder="Имя"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                    />
                    {mode === 'phone' ? (
                        <Input
                            placeholder="+996555123456"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            required
                        />
                    ) : (
                        <Input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    )}
                    {!!error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                        </div>
                    )}
                    <Button
                        type="submit"
                        disabled={sending}
                        isLoading={sending}
                        className="w-full"
                    >
                        Отправить код
                    </Button>
                </form>
            </div>
        </main>
    );
}

