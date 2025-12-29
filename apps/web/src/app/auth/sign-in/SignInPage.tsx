// apps/web/src/app/auth/sign-in/SignInPage.tsx
'use client';

import {useSearchParams, useRouter} from 'next/navigation';
import {useEffect, useCallback, useState} from 'react';

import {supabase} from '@/lib/supabaseClient';

type Mode = 'phone' | 'email';

export default function SignInPage() {
    const sp = useSearchParams();
    const router = useRouter();

    const redirectParam = sp.get('redirect') || '/';
    // Временно отключен вход по телефону - используем только email
    const initialMode: Mode = 'email';

    const [mode] = useState<Mode>(initialMode); // Убрали setMode - режим фиксирован
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- чёткая проверка супер-админа
    const fetchIsSuper = useCallback(async (): Promise<boolean> => {
        const {data, error} = await supabase.rpc('is_super_admin');
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
            const {count, error} = await supabase
                .from('businesses')
                .select('id', {count: 'exact', head: true})
                .eq('owner_id', userId);
            if (error) {
                console.warn('owner check error:', error.message);
                return false;
            }
            return (count ?? 0) > 0;
        },
        []
    );

    // --- роли пользователя (подстраховка)
    const fetchMyRoles = useCallback(async (): Promise<string[]> => {
        const {data, error} = await supabase.rpc('my_role_keys');
        if (error) {
            console.warn('my_role_keys error:', error.message);
            return [];
        }
        return Array.isArray(data) ? (data as string[]) : [];
    }, []);

    const decideRedirect = useCallback(
        async (fallback: string, userId?: string) => {
            if (await fetchIsSuper()) return '/admin';
            if (await fetchOwnsBusiness(userId)) return '/dashboard';
            
            // Проверяем наличие записи в staff (источник правды)
            if (userId) {
                try {
                    const { data: staff } = await supabase
                        .from('staff')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('is_active', true)
                        .maybeSingle();
                    
                    if (staff) return '/staff';
                } catch (error) {
                    console.warn('decideRedirect: error checking staff', error);
                }
            }
            
            const roles = await fetchMyRoles();
            if (roles.includes('owner')) return '/dashboard';
            if (roles.includes('staff')) return '/staff';
            if (roles.some(r => ['admin', 'manager'].includes(r))) return '/dashboard';
            return fallback || '/';
        },
        [fetchIsSuper, fetchMyRoles, fetchOwnsBusiness]
    );

    const decideAndGo = useCallback(
        async (fallback: string) => {
            const {data} = await supabase.auth.getUser();
            const uid = data.user?.id;
            const target = await decideRedirect(fallback, uid);
            router.replace(target);
        },
        [decideRedirect, router]
    );

    // Уже авторизован? — уводим сразу по новой схеме
    useEffect(() => {
        supabase.auth.getUser().then(({data}) => {
            if (data.user) void decideAndGo(redirectParam);
        });
        const {data: sub} = supabase.auth.onAuthStateChange((_ev, session) => {
            if (session?.user) void decideAndGo(redirectParam);
        });
        return () => {
            sub.subscription.unsubscribe();
        };
    }, [decideAndGo, redirectParam]);

    async function signInWithGoogle() {
        setSending(true);
        setError(null);
        try {
            const origin = typeof window !== 'undefined' 
                ? window.location.origin 
                : (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://kezek.kg');
            
            // При входе через Google перенаправляем на post-signup для завершения регистрации
            // (если пользователь новый) или на обычный redirect (если уже зарегистрирован)
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
                // нормализуем телефон (желательно в E.164, если у тебя уже есть хелпер — используй его)
                const phoneNormalized = phone.trim();

                const { error } = await supabase.auth.signInWithOtp({
                    phone: phoneNormalized,
                    options: { channel: 'sms' }, // optionally: shouldCreateUser: true
                });
                if (error) throw error;

                // страница ввода кода из SMS
                router.push(
                    `/auth/verify-otp?phone=${encodeURIComponent(phoneNormalized)}&redirect=${encodeURIComponent(redirectParam)}`
                );
            } else {
                // e-mail magic link (или код из письма, если используешь verifyOtp на странице)
                const origin =
                    typeof window !== 'undefined'
                        ? window.location.origin
                        : (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://kezek.kg');

                // сюда Supabase вернёт пользователя ПОСЛЕ клика по magic link
                const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(redirectParam)}`;

                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        emailRedirectTo,
                        // shouldCreateUser: true, // по необходимости
                    },
                });
                if (error) throw error;

                // страница, где просто показываем "Проверьте почту".
                // Она может периодически вызывать getUser() и, увидев сессию, редиректить на next.
                router.push(
                    `/auth/verify-email?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectParam)}`
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSending(false);
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-800 space-y-6">
                    {/* Заголовок */}
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-2xl mb-4 shadow-lg">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Вход в Kezek</h1>
                        <p className="text-gray-600 dark:text-gray-400">Выберите способ входа</p>
                    </div>

                    {/* Переключатель режима временно скрыт - используется только email */}

                    {/* Форма */}
                    <form onSubmit={sendOtp} className="space-y-4">
                        {mode === 'phone' ? (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    Номер телефона
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    </div>
                                    <input
                                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                        placeholder="+996555123456"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        required
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Мы отправим код подтверждения на этот номер</p>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    E-mail адрес
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <input
                                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                        placeholder="you@example.com"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Мы отправим код подтверждения на этот адрес</p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            </div>
                        )}

                        <button
                            className="w-full px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            disabled={sending}
                            type="submit"
                        >
                            {sending ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Отправляю...
                                </>
                            ) : (
                                <>
                                    Отправить код
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </>
                            )}
                        </button>
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
                    <button
                        type="button"
                        onClick={signInWithGoogle}
                        disabled={sending}
                        className="w-full px-6 py-3.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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
                    </button>

                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                        Нет аккаунта?{' '}
                        <a className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium underline" href="/auth/sign-up">
                            Зарегистрируйтесь
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
}
