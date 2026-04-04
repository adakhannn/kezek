'use client';

import {
    StaffFinanceStatsFilters,
    StaffFinanceStatsRefreshing,
    StaffFinanceStatsShifts,
    StaffFinanceStatsSummary,
} from './StaffFinanceStatsSections';
import { useStaffFinanceStatsData } from './useStaffFinanceStatsData';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
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
            <AlertBanner
                variant="danger"
                title={t('finance.error.title', 'Ошибка загрузки статистики')}
                message={error}
                action={
                    <Button type="button" variant="danger" size="sm" onClick={() => void loadStats()}>
                        {t('finance.retry', 'Попробовать снова')}
                    </Button>
                }
            />
        );
    }

    if (!stats) {
        return (
            <EmptyState
                title={t('finance.empty.title', 'Пока нет данных')}
                description={t('finance.empty.description', 'Статистика появится после первых смен и начислений.')}
                action={
                    <Button type="button" variant="secondary" size="sm" onClick={() => void loadStats()}>
                        {t('finance.refresh', 'Обновить')}
                    </Button>
                }
                compact
            />
        );
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
