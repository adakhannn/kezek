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
                <div className="text-[var(--text-muted)]">{t('finance.loading', 'Loading...')}</div>
            </div>
        );
    }

    if (error) {
        return (
            <AlertBanner
                variant="danger"
                title={t('finance.error.title', 'Failed to load finance stats')}
                message={error}
                action={
                    <Button type="button" variant="danger" size="sm" onClick={() => void loadStats()}>
                        {t('finance.retry', 'Retry')}
                    </Button>
                }
            />
        );
    }

    if (!stats) {
        return (
            <EmptyState
                title={t('finance.empty.title', 'No finance data yet')}
                description={t('finance.empty.description', 'Stats will appear after shifts and payouts are recorded.')}
                action={
                    <Button type="button" variant="secondary" size="sm" onClick={() => void loadStats()}>
                        {t('finance.refresh', 'Refresh')}
                    </Button>
                }
                compact
            />
        );
    }

    return (
        <div className="space-y-5">
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

            {loading && stats ? <StaffFinanceStatsRefreshing t={t} /> : null}

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
