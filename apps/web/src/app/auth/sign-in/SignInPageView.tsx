'use client';

import { TelegramLoginWidget } from '@/components/auth/TelegramLoginWidget';
import { AlertBanner } from '@/components/ui/AlertBanner';

type Mode = 'phone' | 'email';

type SignInPageViewProps = {
    t: (key: string, fallback?: string) => string;
    mode: Mode;
    phone: string;
    email: string;
    sending: boolean;
    error: string | null;
    redirectParam: string;
    setPhone: (value: string) => void;
    setEmail: (value: string) => void;
    sendOtp: (e: React.FormEvent) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithYandex: () => Promise<void>;
    handleTelegramError: (err: string) => void;
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
                        {t('auth.benefits.title', 'Р‘С‹СЃС‚СЂРѕ Рё Р±РµР·РѕРїР°СЃРЅРѕ')}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('auth.benefits.subtitle', 'Р’РѕР№РґРёС‚Рµ Р±РµР· РїР°СЂРѕР»СЏ вЂ” РёСЃРїРѕР»СЊР·СѓР№С‚Рµ eвЂ‘mail, Google РёР»Рё Telegram')}
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
                                {t('auth.benefits.fast.title', 'РњРіРЅРѕРІРµРЅРЅС‹Р№ РІС…РѕРґ')}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                {t('auth.benefits.fast.desc', 'Р‘РµР· СЂРµРіРёСЃС‚СЂР°С†РёРё Рё РїР°СЂРѕР»РµР№ вЂ” РІС‹Р±РµСЂРёС‚Рµ СЃРїРѕСЃРѕР± Рё РІРѕР№РґРёС‚Рµ Р·Р° СЃРµРєСѓРЅРґС‹')}
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
                                {t('auth.benefits.secure.title', 'Р‘РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ')}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                {t('auth.benefits.secure.desc', 'Р’СЃРµ РґР°РЅРЅС‹Рµ Р·Р°С‰РёС‰РµРЅС‹, Р°РєРєР°СѓРЅС‚ СЃРѕР·РґР°С‘С‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїСЂРё РїРµСЂРІРѕРј РІС…РѕРґРµ')}
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
                                {t('auth.benefits.easy.title', 'РџСЂРѕСЃС‚РѕС‚Р°')}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                {t('auth.benefits.easy.desc', 'РћРґРёРЅ РєР»РёРє вЂ” Рё РІС‹ СѓР¶Рµ РІРЅСѓС‚СЂРё. РќРёРєР°РєРёС… СЃР»РѕР¶РЅС‹С… С„РѕСЂРј Рё РґР»РёРЅРЅС‹С… Р°РЅРєРµС‚')}
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
    mode,
    phone,
    email,
    sending,
    error,
    redirectParam,
    setPhone,
    setEmail,
    sendOtp,
    signInWithGoogle,
    signInWithYandex,
    handleTelegramError,
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
                                    {t('auth.subtitle', 'Р’РѕР№РґРёС‚Рµ РёР»Рё СЃРѕР·РґР°Р№С‚Рµ Р°РєРєР°СѓРЅС‚ Р·Р° РїР°СЂСѓ РєР»РёРєРѕРІ вЂ” Р±РµР· РїР°СЂРѕР»СЏ Рё СЃР»РѕР¶РЅС‹С… С„РѕСЂРј')}
                                </p>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                    {t('auth.stepsHint', '1) Р’С‹Р±РµСЂРёС‚Рµ СЃРїРѕСЃРѕР± РІС…РѕРґР° В· 2) РџРѕРґС‚РІРµСЂРґРёС‚Рµ eвЂ‘mail РёР»Рё Р°РєРєР°СѓРЅС‚ В· 3) РњС‹ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРѕР·РґР°РґРёРј РїСЂРѕС„РёР»СЊ')}
                                </p>
                            </div>

                            <form onSubmit={sendOtp} className="space-y-3.5">
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                                        <span className="inline-flex h-1 w-1 rounded-full bg-indigo-500" />
                                        <span>{t('auth.variantEmail', 'Р’Р°СЂРёР°РЅС‚ 1 вЂ” РІС…РѕРґ РїРѕ eвЂ‘mail')}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {t('auth.variantEmailHint', 'РЈРєР°Р¶РёС‚Рµ РїРѕС‡С‚Сѓ, РјС‹ РїСЂРёС€Р»С‘Рј РЅР° РЅРµС‘ Р±РµР·РѕРїР°СЃРЅСѓСЋ СЃСЃС‹Р»РєСѓ/РєРѕРґ РґР»СЏ РІС…РѕРґР°. РџР°СЂРѕР»СЊ РїСЂРёРґСѓРјС‹РІР°С‚СЊ РЅРµ РЅСѓР¶РЅРѕ.')}
                                    </p>
                                </div>

                                {mode === 'phone' ? (
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300 sm:text-sm">
                                            {t('auth.phone.label', 'РќРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°')}
                                        </label>
                                        <input
                                            className="w-full px-4 py-2.5 sm:py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                            placeholder={t('auth.phone.placeholder', '+996555123456')}
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300 sm:text-sm">
                                            {t('auth.email.label', 'E-mail Р°РґСЂРµСЃ')}
                                        </label>
                                        <input
                                            className="w-full px-4 py-2.5 sm:py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                            placeholder={t('auth.email.placeholder', 'you@example.com')}
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                )}

                                {error ? <AlertBanner variant="danger" message={error} compact /> : null}

                                <button
                                    className="w-full px-5 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white text-sm font-bold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={sending}
                                    type="submit"
                                >
                                    {sending
                                        ? t('auth.submit.sending', 'РћС‚РїСЂР°РІР»СЏСЋ...')
                                        : t('auth.submit.idle', 'РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ')}
                                </button>
                            </form>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                                </div>
                                <div className="relative flex justify-center text-xs sm:text-sm">
                                    <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                                        {t('auth.otherMethodsTitle', 'РёР»Рё РІС‹Р±РµСЂРёС‚Рµ Р±С‹СЃС‚СЂС‹Р№ РІС…РѕРґ')}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={signInWithGoogle}
                                disabled={sending}
                                className="w-full px-5 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('auth.google', 'РџСЂРѕРґРѕР»Р¶РёС‚СЊ СЃ Google')}
                            </button>

                            <button
                                type="button"
                                onClick={signInWithYandex}
                                disabled={sending}
                                className="w-full px-5 py-3 bg-[#FC3F1D] dark:bg-[#FC3F1D] text-sm text-white font-semibold rounded-lg hover:bg-[#E6391A] dark:hover:bg-[#E6391A] shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('auth.yandex', 'Р’РѕР№С‚Рё С‡РµСЂРµР· РЇРЅРґРµРєСЃ')}
                            </button>

                            <div className="w-full">
                                <TelegramLoginWidget
                                    redirectTo={redirectParam || '/'}
                                    onError={handleTelegramError}
                                    size="large"
                                />
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
