// apps/web/src/app/staff/finance/components/StatsView.tsx

import { formatInTimeZone } from 'date-fns-tz';

import type { Stats, PeriodKey } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import MonthPickerPopover from '@/components/pickers/MonthPickerPopover';
import { Card } from '@/components/ui/Card';
import { TZ } from '@/lib/time';


interface StatsViewProps {
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

export function StatsView({
    stats,
    allShiftsCount,
    statsPeriod,
    onPeriodChange,
    selectedDate,
    onDateChange,
    selectedMonth,
    onMonthChange,
    selectedYear,
    onYearChange,
}: StatsViewProps) {
    const { t } = useLanguage();

    return (
        <Card variant="elevated" className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t('staff.finance.stats.title', 'Общая статистика по сменам')}
                </h2>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('staff.finance.stats.totalShifts', 'Всего закрытых смен')}: {allShiftsCount}
                </div>
            </div>
            
            {/* Фильтры по периодам */}
            <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => onPeriodChange('day')}
                        className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            statsPeriod === 'day'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        {t('staff.finance.stats.period.day', 'День')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onPeriodChange('month')}
                        className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            statsPeriod === 'month'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        {t('staff.finance.stats.period.month', 'Месяц')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onPeriodChange('year')}
                        className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            statsPeriod === 'year'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        {t('staff.finance.stats.period.year', 'Год')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onPeriodChange('all')}
                        className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            statsPeriod === 'all'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        {t('staff.finance.stats.period.all', 'Все время')}
                    </button>
                </div>
                
                {/* Фильтры для выбранного периода */}
                {statsPeriod === 'day' && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-gray-400">
                            {t('staff.finance.stats.selectDate', 'Выберите дату')}:
                        </label>
                        <DatePickerPopover
                            value={formatInTimeZone(selectedDate, TZ, 'yyyy-MM-dd')}
                            onChange={(dateStr) => {
                                const [year, month, day] = dateStr.split('-').map(Number);
                                onDateChange(new Date(year, month - 1, day));
                            }}
                            className="inline-block"
                        />
                    </div>
                )}
                
                {statsPeriod === 'month' && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-gray-400">
                            {t('staff.finance.stats.selectMonth', 'Выберите месяц')}:
                        </label>
                        <MonthPickerPopover
                            value={formatInTimeZone(selectedMonth, TZ, 'yyyy-MM-dd')}
                            onChange={(dateStr) => {
                                const [year, month] = dateStr.split('-').map(Number);
                                onMonthChange(new Date(year, month - 1, 1));
                            }}
                            className="inline-block"
                        />
                    </div>
                )}
                
                {statsPeriod === 'year' && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-gray-400">
                            {t('staff.finance.stats.selectYear', 'Выберите год')}:
                        </label>
                        <select
                            value={selectedYear}
                            onChange={(e) => onYearChange(Number(e.target.value))}
                            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            {Array.from({ length: 10 }, (_, i) => {
                                const year = new Date().getFullYear() - 5 + i;
                                return (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}
            </div>
            
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                    <div className="text-gray-600 dark:text-gray-400">{t('staff.finance.stats.totalRevenue', 'Общая выручка')}</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalAmount} {t('staff.finance.shift.som', 'сом')}
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="text-gray-600 dark:text-gray-400">{t('staff.finance.stats.staffAmount', 'Сумма сотрудника')}</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalMaster} {t('staff.finance.shift.som', 'сом')}
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="text-gray-600 dark:text-gray-400">{t('staff.finance.stats.businessAmount', 'Сумма бизнеса')}</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalSalon} {t('staff.finance.shift.som', 'сом')}
                    </div>
                </div>
            </div>
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {t('staff.finance.stats.totalLate', 'Суммарное опоздание')}: {stats.totalLateMinutes} {t('staff.finance.shift.minutes', 'минут')}
            </div>
        </Card>
    );
}

