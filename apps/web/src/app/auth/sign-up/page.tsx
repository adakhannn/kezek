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
    // Временно отключена регистрация по телефону - используем только email
    const [mode] = useState<Mode>('email'); // Убрали setMode - режим фиксирован
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function signInWithGoogle() {
        setSending(true);
        setError(null);
        try {
            const origin = typeof window !== 'undefined' 
                ? window.location.origin 
                : (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://kezek.kg');
            
            const redirectTo = `${origin}/auth/callback?next=/auth/post-signup`;
            
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                },
            });
            if (error) throw error;
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setSending(false);
        }
    }

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

                {/* Переключатель режима временно скрыт - используется только email */}

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

                {/* Разделитель */}
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">или</span>
                    </div>
                </div>

                {/* Кнопка Google */}
                <Button
                    type="button"
                    onClick={signInWithGoogle}
                    disabled={sending}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-3"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    Продолжить с Google
                </Button>
            </div>
        </main>
    );
}

