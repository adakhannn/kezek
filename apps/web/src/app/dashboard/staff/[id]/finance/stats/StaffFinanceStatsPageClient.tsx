'use client';

import FinanceSettingsAuditLog from '../components/FinanceSettingsAuditLog';
import StaffFinanceStats from '../components/StaffFinanceStats';

import { ErrorBanner } from '@/app/_components/ErrorBanner';
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
                            const { logError } = require('@/lib/log');
                            logError('StaffFinanceStatsPage', 'StaffFinanceStats error', { error, errorInfo });
                        }}
                        fallback={
                            <ErrorBanner
                                variant="internal"
                                title={t('staff.finance.stats.error.boundary.title', 'Ошибка в компоненте статистики')}
                                message={t(
                                    'staff.finance.stats.error.boundary.message',
                                    'Произошла ошибка при отображении статистики. Попробуйте обновить страницу.',
                                )}
                                onRetry={() => window.location.reload()}
                            />
                        }
                    >
                        <StaffFinanceStats staffId={id} />
                        <FinanceSettingsAuditLog staffId={id} />
                    </ErrorBoundary>
                </div>
            </div>
        </div>
    );
}

