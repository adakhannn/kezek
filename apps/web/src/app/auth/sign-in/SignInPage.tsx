// apps/web/src/app/auth/sign-in/SignInPage.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {useLanguage} from '@/app/_components/i18n/LanguageProvider';
import { TelegramLoginWidget } from '@/components/auth/TelegramLoginWidget';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'phone' | 'email';

export default function SignInPage() {
    const sp = useSearchParams();
    const router = useRouter();

    const redirectParam = sp.get('redirect') || '/';
    const {t} = useLanguage();
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

    // Мемоизируем обработчик ошибок для Telegram, чтобы виджет не пересоздавался при изменении email
    const handleTelegramError = useCallback((err: string) => {
        setError(err);
    }, []);

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
            
            // При входе через Google перенаправляем на callback, который сам решит куда редиректить
            const redirectTo = `${origin}/auth/callback?from=google`;
            
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

    async function signInWithYandex() {
        setSending(true);
        setError(null);
        try {
            const origin = typeof window !== 'undefined' 
                ? window.location.origin 
                : (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://kezek.kg');
            
            // redirect_uri должен быть БЕЗ query параметров для Яндекс OAuth
            const redirectUri = `${origin}/auth/callback-yandex`;
            const redirectTo = `${redirectUri}?redirect=${encodeURIComponent(redirectParam)}`;
            
            // Формируем URL для OAuth Яндекс
            const yandexAuthUrl = new URL('https://oauth.yandex.ru/authorize');
            yandexAuthUrl.searchParams.set('response_type', 'code');
            yandexAuthUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID || '');
            yandexAuthUrl.searchParams.set('redirect_uri', redirectUri);
            
            // Сохраняем redirect параметр в sessionStorage для использования после callback
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('yandex_redirect', redirectParam);
            }
            
            // Редиректим на Яндекс
            window.location.href = yandexAuthUrl.toString();
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
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30 flex items-center justify-center px-3 py-4">
            <div className="w-full max-w-6xl">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="grid md:grid-cols-2 gap-0">
                        {/* Левая колонка - форма входа */}
                        <div className="px-5 py-6 sm:px-8 sm:py-8 space-y-5 sm:space-y-6">
                    {/* Заголовок */}
                    <div className="text-center space-y-1.5">
                        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-2xl mb-3 shadow-lg">
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                            {t('auth.title', 'Kezek')}
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 sm:text-base">
                            {t('auth.subtitle', 'Войдите или создайте аккаунт за пару кликов — без пароля и сложных форм')}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                            {t(
                                'auth.stepsHint',
                                '1) Выберите способ входа · 2) Подтвердите e‑mail или аккаунт · 3) Мы автоматически создадим профиль'
                            )}
                        </p>
                    </div>

                    {/* Переключатель режима временно скрыт - используется только email */}

                    {/* Вариант 1. Вход по e‑mail */}
                    <form onSubmit={sendOtp} className="space-y-3.5">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                                <span className="inline-flex h-1 w-1 rounded-full bg-indigo-500" />
                                <span>{t('auth.variantEmail', 'Вариант 1 — вход по e‑mail')}</span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {t(
                                    'auth.variantEmailHint',
                                    'Укажите почту, мы пришлём на неё безопасную ссылку/код для входа. Пароль придумывать не нужно.'
                                )}
                            </p>
                        </div>
                        {mode === 'phone' ? (
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300 sm:text-sm">
                                    {t('auth.phone.label', 'Номер телефона')}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    </div>
                                    <input
                                        className="w-full pl-11 pr-3 py-2.5 sm:py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                        placeholder={t('auth.phone.placeholder', '+996555123456')}
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        required
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                    {t('auth.phone.help', 'Мы отправим код подтверждения на этот номер')}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300 sm:text-sm">
                                    {t('auth.email.label', 'E-mail адрес')}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <input
                                        className="w-full pl-11 pr-3 py-2.5 sm:py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                        placeholder={t('auth.email.placeholder', 'you@example.com')}
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                    {t('auth.email.help', 'На эту почту придёт одноразовая ссылка или код для входа.')}
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5">
                                <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 sm:text-sm">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            </div>
                        )}

                        <button
                            className="w-full px-5 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white text-sm font-bold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            disabled={sending}
                            type="submit"
                        >
                            {sending ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {t('auth.submit.sending', 'Отправляю...')}
                                </>
                            ) : (
                                <>
                                    {t('auth.submit.idle', 'Отправить код')}
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Разделитель и подпись для других способов */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-xs sm:text-sm">
                            <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                                {t('auth.otherMethodsTitle', 'или выберите быстрый вход')}
                            </span>
                        </div>
                    </div>

                    {/* Вариант 2. Вход через Google */}
                    <button
                        type="button"
                        onClick={signInWithGoogle}
                        disabled={sending}
                        className="w-full px-5 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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
                        {t('auth.google', 'Продолжить с Google')}
                    </button>

                    {/* Вариант 2.5. Вход через Яндекс */}
                    <button
                        type="button"
                        onClick={signInWithYandex}
                        disabled={sending}
                        className="w-full px-5 py-3 bg-[#FC3F1D] dark:bg-[#FC3F1D] text-sm text-white font-semibold rounded-lg hover:bg-[#E6391A] dark:hover:bg-[#E6391A] shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.5 0C5.596 0 0 5.596 0 12.5S5.596 25 12.5 25 25 19.404 25 12.5 19.404 0 12.5 0zm0 4.167c3.24 0 5.833 2.593 5.833 5.833S15.74 15.833 12.5 15.833 6.667 13.24 6.667 10s2.593-5.833 5.833-5.833z"/>
                        </svg>
                        {t('auth.yandex', 'Войти через Яндекс')}
                    </button>

                    {/* Вариант 3. Вход через Telegram */}
                    <TelegramLoginWidget
                        redirectTo={redirectParam || '/'}
                        onError={handleTelegramError}
                        size="large"
                    />

                    {/* Вариант 4. Вход через WhatsApp */}
                    <button
                        type="button"
                        onClick={() => router.push(`/auth/whatsapp?redirect=${encodeURIComponent(redirectParam)}`)}
                        disabled={sending}
                        className="w-full px-5 py-3 bg-[#25D366] dark:bg-[#25D366] text-sm text-white font-semibold rounded-lg hover:bg-[#20BA5A] dark:hover:bg-[#20BA5A] shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        {t('auth.whatsapp', 'Войти через WhatsApp')}
                    </button>

                            <div className="space-y-1 text-center text-[11px] text-gray-500 dark:text-gray-400">
                                <p>{t('auth.firstTime.title')}</p>
                                <p>{t('auth.firstTime.subtitle')}</p>
                            </div>
                        </div>

                        {/* Правая колонка - информация/преимущества */}
                        <div className="hidden md:flex flex-col justify-center px-8 py-8 bg-gradient-to-br from-indigo-50 to-pink-50 dark:from-indigo-950/30 dark:to-pink-950/30 border-l border-gray-200 dark:border-gray-800">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                        {t('auth.benefits.title', 'Быстро и безопасно')}
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {t('auth.benefits.subtitle', 'Войдите без пароля — используйте e‑mail, Google, Telegram или WhatsApp')}
                                    </p>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                                {t('auth.benefits.fast.title', 'Мгновенный вход')}
                                            </h3>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                {t('auth.benefits.fast.desc', 'Без регистрации и паролей — выберите способ и войдите за секунды')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                                {t('auth.benefits.secure.title', 'Безопасность')}
                                            </h3>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                {t('auth.benefits.secure.desc', 'Все данные защищены, аккаунт создаётся автоматически при первом входе')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                                {t('auth.benefits.easy.title', 'Простота')}
                                            </h3>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                {t('auth.benefits.easy.desc', 'Один клик — и вы уже внутри. Никаких сложных форм и длинных анкет')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
