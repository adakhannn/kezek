'use client';

import AllStaffFinanceStats from './components/AllStaffFinanceStats';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function FinancePageClient() {
    const { t } = useLanguage();

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {t('finance.title', 'Финансовая статистика сотрудников')}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('finance.subtitle', 'Обзор финансовых показателей всех сотрудников')}
                    </p>
                </div>
            </div>

            {/* Статистика */}
            <AllStaffFinanceStats />
        </div>
    );
}


