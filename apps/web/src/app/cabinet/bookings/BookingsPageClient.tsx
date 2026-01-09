'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function BookingsPageClient() {
    const { t } = useLanguage();

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 shadow-lg border border-gray-200 dark:border-gray-800 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t('cabinet.bookings.auth.title', 'Войдите, чтобы посмотреть записи')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
                {t('cabinet.bookings.auth.desc', 'Авторизуйтесь, чтобы увидеть свои бронирования')}
            </p>
            <a
                href="/auth/sign-in"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200"
            >
                {t('cabinet.bookings.auth.button', 'Войти')}
            </a>
        </div>
    );
}

