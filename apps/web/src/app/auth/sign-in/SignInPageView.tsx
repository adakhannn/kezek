'use client';

import Link from 'next/link';

import { TelegramBotLogin } from '@/components/auth/TelegramBotLogin';
import { TelegramLoginWidget } from '@/components/auth/TelegramLoginWidget';
import { AlertBanner } from '@/components/ui/AlertBanner';

type SignInPageViewProps = {
    t: (key: string, fallback?: string) => string;
    sending: boolean;
    error: string | null;
    redirectParam: string;
    signInWithGoogle: () => Promise<void>;
    signInWithYandex: () => Promise<void>;
    handleTelegramError: (err: string) => void;
    whatsAppSignInEnabled: boolean;
};

function SignInBenefits({
    t,
}: {
    t: (key: string, fallback?: string) => string;
}) {
    return (
        <div className="hidden md:flex flex-col justify-center px-8 py-8 bg-gradient-to-br from-indigo-50 to-pink-50 dark:from-indigo-950/30 dark:to-pink-950/30 border-l border-gray-200 dark:border-gray-800">
            <div className="space-y-6">
                <div className="space-y-3">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {t('auth.benefits.title', 'Быстро и безопасно')}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('auth.benefits.subtitle', 'Войдите через удобный социальный аккаунт')}
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
    );
}

export function SignInPageView({
    t,
    sending,
    error,
    redirectParam,
    signInWithGoogle,
    signInWithYandex,
    handleTelegramError,
    whatsAppSignInEnabled,
}: SignInPageViewProps) {
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30 flex items-center justify-center px-3 py-4">
            <div className="w-full max-w-6xl">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="grid md:grid-cols-2 gap-0">
                        <div className="px-5 py-6 sm:px-8 sm:py-8 space-y-5 sm:space-y-6">
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
                                    {t('auth.stepsHint', '1) Выберите соцсеть · 2) Подтвердите аккаунт · 3) Мы автоматически создадим профиль')}
                                </p>
                            </div>

                            {error ? <AlertBanner variant="danger" message={error} compact /> : null}

                            <button
                                type="button"
                                onClick={signInWithGoogle}
                                disabled={sending}
                                className="w-full px-5 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('auth.google', 'Продолжить с Google')}
                            </button>

                            <button
                                type="button"
                                onClick={signInWithYandex}
                                disabled={sending}
                                className="w-full px-5 py-3 bg-[#FC3F1D] dark:bg-[#FC3F1D] text-sm text-white font-semibold rounded-lg hover:bg-[#E6391A] dark:hover:bg-[#E6391A] shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('auth.yandex', 'Войти через Яндекс')}
                            </button>

                            {whatsAppSignInEnabled ? (
                                <Link
                                    href={`/auth/whatsapp?redirect=${encodeURIComponent(redirectParam || '/')}`}
                                    className="block w-full px-5 py-3 bg-[#25D366] text-sm text-white font-semibold rounded-lg hover:bg-[#1fbe59] shadow-sm hover:shadow-md transition-all duration-200 text-center"
                                >
                                    {t('auth.whatsapp', 'Войти через WhatsApp')}
                                </Link>
                            ) : null}

                            <div className="w-full">
                                {process.env.NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED === 'true' ? <TelegramBotLogin redirectTo={redirectParam || '/'} /> : <TelegramLoginWidget
                                    redirectTo={redirectParam || '/'}
                                    onError={handleTelegramError}
                                    size="large"
                                />}
                            </div>

                            <div className="space-y-1 text-center text-[11px] text-gray-500 dark:text-gray-400">
                                <p>{t('auth.firstTime.title')}</p>
                                <p>{t('auth.firstTime.subtitle')}</p>
                            </div>
                        </div>

                        <SignInBenefits t={t} />
                    </div>
                </div>
            </div>
        </main>
    );
}

