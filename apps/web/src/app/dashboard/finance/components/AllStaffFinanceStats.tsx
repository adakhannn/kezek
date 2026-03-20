'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AllStaffFinanceStatsFilters } from './AllStaffFinanceStatsFilters';
import { AllStaffFinanceStatsOverview } from './AllStaffFinanceStatsOverview';
import { AllStaffFinanceStatsTable } from './AllStaffFinanceStatsTable';
import { useAllStaffFinanceStats } from './useAllStaffFinanceStats';

export default function AllStaffFinanceStats() {
    const { t, locale } = useLanguage();
    const {
        loading,
        period,
        setPeriod,
        date,
        setDate,
        staffStats,
        totalStats,
        error,
        branches,
        branchId,
        setBranchId,
        loadStats,
        formatPeriodLabel,
    } = useAllStaffFinanceStats(t, locale);

    if (loading && !totalStats) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500 dark:text-gray-400">{t('finance.loading', 'Загрузка...')}</div>
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

    return (
        <div className="space-y-4 sm:space-y-6">
            <AllStaffFinanceStatsFilters
                t={t}
                loading={loading}
                period={period}
                setPeriod={setPeriod}
                date={date}
                setDate={setDate}
                branches={branches}
                branchId={branchId}
                setBranchId={setBranchId}
                onRefresh={() => void loadStats()}
            />

            <AllStaffFinanceStatsOverview
                t={t}
                locale={locale}
                totalStats={totalStats}
                formatPeriodLabel={formatPeriodLabel}
            />

            <AllStaffFinanceStatsTable t={t} locale={locale} period={period} staffStats={staffStats} />
        </div>
    );
}
