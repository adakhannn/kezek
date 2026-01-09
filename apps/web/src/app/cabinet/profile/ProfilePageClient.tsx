'use client';

import ProfileForm from '../components/ProfileForm';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function ProfilePageClient() {
    const { t } = useLanguage();

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3 mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-xl">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {t('cabinet.profile.title', 'Редактирование профиля')}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {t('cabinet.profile.subtitle', 'Управляйте своей личной информацией')}
                        </p>
                    </div>
                </div>
                <ProfileForm />
            </div>
        </div>
    );
}

