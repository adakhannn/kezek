import { Suspense } from 'react';

import type { PeriodKey, Stats } from '../types';

import { StatsView } from './StatsView';

interface FinanceStatsTabProps {
    className: string;
    t: (key: string, fallback?: string) => string;
    stats: Stats;
    allShiftsCount: number;
    statsPeriod: PeriodKey;
    onPeriodChange: (period: PeriodKey) => void;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    selectedMonth: Date;
    onMonthChange: (month: Date) => void;
    selectedYear: number;
    onYearChange: (year: number) => void;
}

export function FinanceStatsTab({ className, t, ...props }: FinanceStatsTabProps) {
    return (
        <div className={className}>
            <Suspense
                fallback={
                    <div className="flex items-center justify-center py-12">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            {t('staff.finance.stats.loading', 'Загрузка статистики...')}
                        </div>
                    </div>
                }
            >
                <StatsView {...props} />
            </Suspense>
        </div>
    );
}
