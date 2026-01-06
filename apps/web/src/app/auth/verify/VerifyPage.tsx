// apps/web/src/app/auth/verify/page.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'phone' | 'email';

export default function VerifyPage() {
    const sp = useSearchParams();
    const router = useRouter();

    const mode: Mode = (sp.get('mode') as Mode) || 'phone';
    const phone = sp.get('phone') || '';
    const email = sp.get('email') || '';
    const redirect = sp.get('redirect') || '/';
    const isSignUp = redirect.includes('post-signup');

    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resending, setResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [editingContact, setEditingContact] = useState(false);
    const [newContact, setNewContact] = useState(mode === 'phone' ? phone : email);

    const fetchIsSuper = useCallback(async (): Promise<boolean> => {
        const { data, error } = await supabase.rpc('is_super_admin');
        if (error) {
            console.warn('is_super_admin error:', error.message);
            return false;
        }
        return !!data;
    }, []);

    const fetchOwnsBusiness = useCallback(async (userId?: string): Promise<boolean> => {
        if (!userId) return false;
        const { count, error } = await supabase
            .from('businesses')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', userId);
        if (error) {
            console.warn('owner check error:', error.message);
            return false;
        }
        return (count ?? 0) > 0;
    }, []);

    const decideAndGo = useCallback(
        async (fallback: string) => {
            const { data } = await supabase.auth.getUser();
            const uid = data.user?.id;

            if (await fetchIsSuper()) {
                router.replace('/admin');
                return;
            }
            if (await fetchOwnsBusiness(uid)) {
                router.replace('/dashboard');
                return;
            }
            router.replace(fallback || '/');
        },
        [fetchIsSuper, fetchOwnsBusiness, router]
    );

    // Таймер для повторной отправки
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    async function resendCode() {
        setResending(true);
        setError(null);
        try {
            if (mode === 'phone') {
                const phoneToUse = editingContact ? normalizePhoneToE164(newContact.trim()) : phone;
                if (!phoneToUse) {
                    throw new Error('Некорректный номер телефона');
                }
                const { error } = await supabase.auth.signInWithOtp({
                    phone: phoneToUse,
                    options: {
                        channel: 'sms',
                        shouldCreateUser: isSignUp,
                    },
                });
                if (error) throw error;
                if (editingContact) {
                    setEditingContact(false);
                    router.replace(`/auth/verify?mode=phone&phone=${encodeURIComponent(phoneToUse)}&redirect=${encodeURIComponent(redirect)}`);
                    setResendCooldown(60);
                    return;
                }
            } else {
                const emailToUse = editingContact ? newContact.trim() : email;
                if (!emailToUse || !emailToUse.includes('@')) {
                    throw new Error('Некорректный e-mail');
                }
                const { error } = await supabase.auth.signInWithOtp({
                    email: emailToUse,
                    options: {
                        shouldCreateUser: isSignUp,
                        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
                    },
                });
                if (error) throw error;
                if (editingContact) {
                    setEditingContact(false);
                    router.replace(`/auth/verify?mode=email&email=${encodeURIComponent(emailToUse)}&redirect=${encodeURIComponent(redirect)}`);
                    setResendCooldown(60);
                    return;
                }
            }
            setResendCooldown(60); // 60 секунд до следующей отправки
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setResending(false);
        }
    }

    function handleChangeContact() {
        if (editingContact) {
            // Сохраняем изменения и отправляем код на новый контакт
            resendCode();
        } else {
            setEditingContact(true);
            setError(null);
        }
    }

    function handleCancelEdit() {
        setEditingContact(false);
        setNewContact(mode === 'phone' ? phone : email);
        setError(null);
    }

    async function verify(e: React.FormEvent) {
        e.preventDefault();
        setVerifying(true);
        setError(null);
        try {
            if (mode === 'phone') {
                if (!phone) throw new Error('Не передан номер телефона');
                const { error } = await supabase.auth.verifyOtp({
                    phone,
                    token: code.trim(),
                    type: 'sms',
                });
                if (error) throw error;
            } else {
                if (!email) throw new Error('Не передан e-mail');
                const { error } = await supabase.auth.verifyOtp({
                    email,
                    token: code.trim(),
                    type: 'email',
                });
                if (error) throw error;
            }

            // Обновляем серверные компоненты перед редиректом
            router.refresh();
            // Решаем редирект по ролям/владению бизнесом
            await decideAndGo(redirect);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setVerifying(false);
        }
    }

    const currentContact = mode === 'phone' ? phone : email;
    const displayContact = editingContact ? newContact : currentContact;

    return (
        <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-indigo-950 dark:via-gray-900 dark:to-pink-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-8 space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Подтверждение</h1>
                    {!editingContact ? (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            Мы отправили код на <b className="text-gray-900 dark:text-gray-100">{currentContact}</b>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {mode === 'phone' ? 'Введите новый номер телефона' : 'Введите новый e-mail'}
                        </div>
                    )}
                </div>

                {editingContact && (
                    <div className="space-y-2">
                        <Input
                            type={mode === 'phone' ? 'tel' : 'email'}
                            placeholder={mode === 'phone' ? '+996555123456' : 'you@example.com'}
                            value={newContact}
                            onChange={(e) => setNewContact(e.target.value)}
                            required
                        />
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="flex-1"
                            >
                                Отмена
                            </Button>
                            <Button
                                type="button"
                                onClick={handleChangeContact}
                                disabled={resending || !newContact.trim()}
                                isLoading={resending}
                                className="flex-1"
                            >
                                Отправить код
                            </Button>
                        </div>
                    </div>
                )}

                {!editingContact && (
                    <form onSubmit={verify} className="space-y-4">
                        <Input
                            placeholder="000000"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            inputMode="numeric"
                            required
                            className="text-center text-2xl tracking-widest"
                            maxLength={6}
                        />
                        {!!error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                            </div>
                        )}
                        <Button
                            type="submit"
                            disabled={verifying || !code.trim()}
                            isLoading={verifying}
                            className="w-full"
                        >
                            Подтвердить
                        </Button>
                    </form>
                )}

                {!editingContact && (
                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={resendCode}
                            disabled={resending || resendCooldown > 0}
                            isLoading={resending}
                            className="w-full"
                        >
                            {resendCooldown > 0
                                ? `Повторно отправить код (${resendCooldown}с)`
                                : 'Повторно отправить код'}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleChangeContact}
                            className="w-full text-sm"
                        >
                            Изменить {mode === 'phone' ? 'номер' : 'e-mail'}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => router.push('/auth/sign-in')}
                            className="w-full text-sm text-gray-500 dark:text-gray-400"
                        >
                            ← Назад
                        </Button>
                    </div>
                )}
            </div>
        </main>
    );
}
