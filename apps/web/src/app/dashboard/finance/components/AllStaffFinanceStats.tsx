'use client';


import {
    AllStaffFinanceStatsFilters,
    AllStaffFinanceStatsTable,
    AllStaffFinanceStatsTotals,
} from './AllStaffFinanceStatsSections';
import { useAllStaffFinanceStatsData } from './useAllStaffFinanceStatsData';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

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

    if (!totalStats && staffStats.length === 0 && !loading) {
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
