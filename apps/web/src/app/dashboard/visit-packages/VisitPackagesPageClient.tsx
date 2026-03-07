'use client';

import { useState } from 'react';


import SoldPackagesListClient from './SoldPackagesListClient';
import VisitPackagesListClient from './VisitPackagesListClient';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type TabKey = 'plans' | 'sold';

export default function VisitPackagesPageClient() {
    const { t } = useLanguage();
    const [tab, setTab] = useState<TabKey>('plans');

    return (
        <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
                <button
                    type="button"
                    onClick={() => setTab('plans')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                        tab === 'plans'
                            ? 'bg-white dark:bg-gray-900 border border-b-0 border-gray-200 dark:border-gray-800 -mb-0.5 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                >
                    {t('dashboard.visitPackages.tabPlans', 'Типы пакетов')}
                </button>
                <button
                    type="button"
                    onClick={() => setTab('sold')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                        tab === 'sold'
                            ? 'bg-white dark:bg-gray-900 border border-b-0 border-gray-200 dark:border-gray-800 -mb-0.5 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                >
                    {t('dashboard.visitPackages.tabSold', 'Проданные пакеты')}
                </button>
            </div>

            {tab === 'plans' && <VisitPackagesListClient />}
            {tab === 'sold' && <SoldPackagesListClient />}
        </div>
    );
}
