'use client';


import {
    AllStaffFinanceStatsFilters,
    AllStaffFinanceStatsTable,
    AllStaffFinanceStatsTotals,
} from './AllStaffFinanceStatsSections';
import { useAllStaffFinanceStatsData } from './useAllStaffFinanceStatsData';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function AllStaffFinanceStats() {
    const { t, locale } = useLanguage();
    const {
        loading,
        period,
        date,
        staffStats,
        totalStats,
        error,
        branches,
        branchId,
        setPeriod,
        setDate,
        setBranchId,
        loadStats,
    } = useAllStaffFinanceStatsData({ t });

    const formatPeriodLabel = () => {
        if (period === 'day') {
            return new Date(`${date}T12:00:00`).toLocaleDateString(
                locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU',
                {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                },
            );
        }

        if (period === 'month') {
            const [year, month] = date.split('-');
            return new Date(`${year}-${month}-01`).toLocaleDateString(
                locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU',
                {
                    month: 'long',
                    year: 'numeric',
                },
            );
        }

        return date.split('-')[0];
    };

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
                period={period}
                date={date}
                branchId={branchId}
                branches={branches}
                loading={loading}
                onPeriodChange={setPeriod}
                onDateChange={setDate}
                onBranchChange={setBranchId}
                onRefresh={() => {
                    void loadStats();
                }}
                t={t}
            />

            {totalStats && (
                <AllStaffFinanceStatsTotals
                    totalStats={totalStats}
                    periodLabel={formatPeriodLabel()}
                    locale={locale}
                    t={t}
                />
            )}

            <AllStaffFinanceStatsTable staffStats={staffStats} period={period} locale={locale} t={t} />
        </div>
    );
}
