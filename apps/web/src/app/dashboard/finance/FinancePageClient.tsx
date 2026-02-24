'use client';

import AllStaffFinanceStats from './components/AllStaffFinanceStats';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type FinancePageClientProps = {
    bizName?: string | null;
    bizCity?: string | null;
};

export default function FinancePageClient({ bizName, bizCity }: FinancePageClientProps) {
    const { t } = useLanguage();

    const displayBizName = bizName || t('finance.biz.defaultName', 'Ваш бизнес в Kezek');

    return (
        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {t('finance.title', 'Финансовая статистика сотрудников')}
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('finance.subtitle', 'Обзор финансовых показателей всех сотрудников')}
                    </p>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('finance.biz.context', 'Бизнес')}: {displayBizName}
                        {bizCity ? ` · ${bizCity}` : ''}
                    </p>
                </div>
            </div>

            {/* Статистика */}
            <AllStaffFinanceStats />
        </div>
    );
}


