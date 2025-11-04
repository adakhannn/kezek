// apps/web/src/app/auth/sign-in/SignInPage.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useCallback, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

type Mode = 'phone' | 'email';

export default function SignInPage() {
    const sp = useSearchParams();
    const router = useRouter();

    const redirectParam = sp.get('redirect') || '/';
    const initialMode = (sp.get('mode') as Mode) ?? 'phone';

    const [mode, setMode] = useState<Mode>(initialMode);
    const [phone, setPhone] = useState('');
    const [sending, setSending] = useState(false);
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- чёткая проверка супер-админа
    const fetchIsSuper = useCallback(async (): Promise<boolean> => {
        const { data, error } = await supabase.rpc('is_super_admin');
        if (error) {
            console.warn('is_super_admin error:', error.message);
            return false;
        }
        return !!data;
    }, []);

    // --- есть ли бизнес, где я владелец (источник правды — businesses.owner_id)
    const fetchOwnsBusiness = useCallback(
        async (userId: string | undefined): Promise<boolean> => {
            if (!userId) return false;
            const { data, error } = await supabase
                .from('businesses')
                .select('id', { count: 'exact', head: true })
                .eq('owner_id', userId)
                .limit(1);
            if (error) {
                console.warn('owner check error:', error.message);
                return false;
            }
            // при head:true data=null, используем count
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (data) === null ? ((error as any)?.count ?? 0) > 0 : true;
        },
        []
    );

    // --- роли пользователя (на будущее; тут уже не критично)
    const fetchMyRoles = useCallback(async (): Promise<string[]> => {
        const { data, error } = await supabase.rpc('my_role_keys');
        if (error) {
            console.warn('my_role_keys error:', error.message);
            return [];
        }
        return Array.isArray(data) ? (data as string[]) : [];
    }, []);

    const decideRedirect = useCallback(
        async (fallback: string, userId?: string) => {
            if (await fetchIsSuper()) return '/admin';
            // сначала смотрим фактическое владение бизнесом
            if (await fetchOwnsBusiness(userId)) return '/dashboard';

            // дополнительная подстраховка: роль owner (если вдруг понадобится)
            const roles = await fetchMyRoles();
            if (roles.includes('owner')) return '/dashboard';

            return fallback || '/';
        },
        [fetchIsSuper, fetchMyRoles, fetchOwnsBusiness]
    );

    const decideAndGo = useCallback(
        async (fallback: string) => {
            // достаём свежего пользователя (после OTP/пароля)
            const { data } = await supabase.auth.getUser();
            const uid = data.user?.id;
            const target = await decideRedirect(fallback, uid);
            router.replace(target);
        },
        [decideRedirect, router]
    );

    // Уже авторизован? — уводим сразу по новой схеме
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) void decideAndGo(redirectParam);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
            if (session?.user) void decideAndGo(redirectParam);
        });
        return () => {
            sub.subscription.unsubscribe();
        };
    }, [decideAndGo, redirectParam]);

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
            // На /auth/verify после ввода кода тоже вызываем decideAndGo(redirectParam)
            router.push(
                `/auth/verify?phone=${encodeURIComponent(phone)}&redirect=${encodeURIComponent(redirectParam)}`
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
            const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (error) throw error;
            await decideAndGo(redirectParam);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoadingEmail(false);
        }
    }

    return (
        <main className="mx-auto max-w-sm p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Вход</h1>

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
                    <button className="border rounded px-3 py-2 w-full disabled:opacity-50" disabled={sending} type="submit">
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
                    <button className="border rounded px-3 py-2 w-full disabled:opacity-50" disabled={loadingEmail} type="submit">
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
