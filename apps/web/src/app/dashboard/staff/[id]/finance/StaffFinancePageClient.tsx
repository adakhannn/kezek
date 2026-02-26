'use client';

import { ErrorBanner } from '@/app/_components/ErrorBanner';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { FinancePage } from '@/app/staff/finance/components/FinancePage';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
                            {t('staff.finance.shift.title', 'Управление сменой')}: {fullName ?? ''}
                        </h1>
                        <a
                            href={`/dashboard/staff/${id}/finance/stats`}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            {t('finance.staffStats.title', 'Статистика')}
                        </a>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('staff.finance.shift.subtitle', 'Управление текущей сменой, клиентами и расчетами')}
                    </p>
                </div>
            </div>

            {/* Основной контент - управление сменой и клиентами */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <ErrorBoundary
                    onError={(error, errorInfo) => {
                        // Дополнительное логирование для finance компонентов
                        const { logError } = require('@/lib/log');
                        logError('StaffFinancePage', 'FinancePage error', { error, errorInfo });
                    }}
                    fallback={
                        <div className="p-6">
                            <ErrorBanner
                                variant="internal"
                                title={t('staff.finance.error.boundary.title', 'Ошибка в компоненте управления сменой')}
                                message={t(
                                    'staff.finance.error.boundary.message',
                                    'Произошла ошибка при отображении компонента. Попробуйте обновить страницу.',
                                )}
                                onRetry={() => window.location.reload()}
                            />
                        </div>
                    }
                >
                    <FinancePage staffId={id} showHeader={false} />
                </ErrorBoundary>
            </div>
        </div>
    );
}


