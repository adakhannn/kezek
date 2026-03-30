'use client';

import {
    StaffFinanceStatsFilters,
    StaffFinanceStatsRefreshing,
    StaffFinanceStatsShifts,
    StaffFinanceStatsSummary,
} from './StaffFinanceStatsSections';
import { useStaffFinanceStatsData } from './useStaffFinanceStatsData';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { formatDateBrowser, formatMonthYear } from '@/lib/dateFormat';



export default function StaffFinanceStats({ staffId }: { staffId: string }) {
    const { t, locale } = useLanguage();
    const toast = useToast();
    const {
        loading,
        period,
        date,
        stats,
        error,
        setPeriod,
        setDate,
        loadStats,
    } = useStaffFinanceStatsData({ staffId, t });

    const formatPeriodLabel = () => {
        if (period === 'day') {
            return formatDateBrowser(date, locale);
        }
        if (period === 'month') {
            return formatMonthYear(date, locale);
        }
        return date.split('-')[0];
    };

    if (loading && !stats) {
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

    if (!stats) {
        return null;
    }

    return (
        <div className="space-y-6">
            <StaffFinanceStatsFilters
                period={period}
                date={date}
                loading={loading}
                onPeriodChange={setPeriod}
                onDateChange={setDate}
                onRefresh={() => {
                    void loadStats();
                }}
                t={t}
            />

            {loading && stats && <StaffFinanceStatsRefreshing t={t} />}

            <StaffFinanceStatsSummary
                stats={stats}
                period={period}
                periodLabel={formatPeriodLabel()}
                locale={locale}
                t={t}
            />

            <StaffFinanceStatsShifts
                stats={stats}
                locale={locale}
                t={t}
                onHoursUpdated={loadStats}
            />

            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}
