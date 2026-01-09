'use client';

import StaffFinanceStats from './components/StaffFinanceStats';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function StaffFinancePageClient({
    id,
    fullName,
}: {
    id: string;
    fullName: string | null;
}) {
    const { t } = useLanguage();

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <a
                        href={`/dashboard/staff/${id}`}
                        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t('staff.detail.back.title', 'Вернуться к списку сотрудников')}
                    </a>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {t('staff.finance', 'Финансы')}: {fullName ?? ''}
                    </h1>
                </div>
            </div>

            {/* Статистика */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                    {t('finance.staffStats.title', 'Статистика по сотрудникам')}
                </h2>
                <StaffFinanceStats staffId={id} />
            </div>
        </div>
    );
}


