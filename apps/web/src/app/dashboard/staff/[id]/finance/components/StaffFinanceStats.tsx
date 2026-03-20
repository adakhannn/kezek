'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { formatDate } from '@/lib/dateFormat';
import { useToast } from '@/hooks/useToast';
import { StaffFinanceStatsFilters } from './StaffFinanceStatsFilters';
import { StaffFinanceStatsOverview } from './StaffFinanceStatsOverview';
import { StaffFinanceShiftCard } from './StaffFinanceShiftCard';
import { useStaffFinanceStats } from './useStaffFinanceStats';

export default function StaffFinanceStats({ staffId }: { staffId: string }) {
    const { t, locale } = useLanguage();
    const toast = useToast();
    const {
        loading,
        period,
        setPeriod,
        date,
        setDate,
        stats,
        error,
        loadStats,
        formatPeriodLabel,
    } = useStaffFinanceStats(staffId, t, locale);

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500 dark:text-gray-400">
                    {t('finance.loading', 'Загрузка...')}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            </div>
        );
    }

    if (!stats) {
        return null;
    }

    return (
        <div className="space-y-6">
            <StaffFinanceStatsFilters
                period={period}
                setPeriod={setPeriod}
                date={date}
                setDate={setDate}
                loading={loading}
                loadStats={loadStats}
                t={t}
            />

            <StaffFinanceStatsOverview
                stats={stats}
                period={period}
                formatPeriodLabel={formatPeriodLabel()}
                locale={locale}
                t={t}
            />

            {stats.shifts.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wide">
                        {t('finance.staffStats.shiftsPeriod', 'Смены за период')}
                    </h3>
                    <div className="space-y-2">
                        {stats.shifts.map((shift) => (
                            <StaffFinanceShiftCard
                                key={shift.id}
                                shift={shift}
                                formatDate={formatDate}
                                locale={locale}
                                t={t}
                            />
                        ))}
                    </div>
                </div>
            )}

            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}
