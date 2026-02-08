'use client';

import StaffFinanceStats from '../components/StaffFinanceStats';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function StaffFinanceStatsPageClient({
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
                        href={`/dashboard/staff/${id}/finance`}
                        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t('staff.finance.backToShift', 'Вернуться к управлению сменой')}
                    </a>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {t('finance.staffStats.title', 'Статистика по сотрудникам')}: {fullName ?? ''}
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('finance.staffStats.subtitle', 'Детальная статистика по сменам и финансовым показателям')}
                    </p>
                </div>
            </div>

            {/* Статистика */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="p-6">
                    <ErrorBoundary
                        onError={(error, errorInfo) => {
                            // Дополнительное логирование для stats компонентов
                            console.error('StaffFinanceStats error:', error, errorInfo);
                        }}
                        fallback={
                            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                            {t('staff.finance.stats.error.boundary.title', 'Ошибка в компоненте статистики')}
                                        </p>
                                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                            {t('staff.finance.stats.error.boundary.message', 'Произошла ошибка при отображении статистики. Попробуйте обновить страницу.')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => window.location.reload()}
                                            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
                                        >
                                            {t('staff.finance.stats.error.boundary.reload', 'Обновить страницу')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        }
                    >
                        <StaffFinanceStats staffId={id} />
                    </ErrorBoundary>
                </div>
            </div>
        </div>
    );
}

