'use client';

import type { BranchOption, Period } from './allStaffFinanceStatsTypes';

type TranslationFn = (key: string, fallback: string) => string;

type Props = {
    t: TranslationFn;
    loading: boolean;
    period: Period;
    setPeriod: (period: Period) => void;
    date: string;
    setDate: (date: string) => void;
    branches: BranchOption[];
    branchId: string | 'all';
    setBranchId: (branchId: string | 'all') => void;
    onRefresh: () => void;
};

export function AllStaffFinanceStatsFilters({
    t,
    loading,
    period,
    setPeriod,
    date,
    setDate,
    branches,
    branchId,
    setBranchId,
    onRefresh,
}: Props) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
                {(['day', 'month', 'year'] as const).map((value) => (
                    <button
                        key={value}
                        onClick={() => setPeriod(value)}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                            period === value
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {t(`finance.period.${value}`, value === 'day' ? 'День' : value === 'month' ? 'Месяц' : 'Год')}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
                {branches.length > 0 && (
                    <select
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value as string | 'all')}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                    >
                        <option value="all">{t('finance.branch.all', 'Все филиалы')}</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>
                )}
                <input
                    type={period === 'year' ? 'number' : period === 'month' ? 'month' : 'date'}
                    value={period === 'year' ? date.split('-')[0] : date}
                    onChange={(e) => {
                        if (period === 'year') {
                            setDate(`${e.target.value}-01-01`);
                            return;
                        }

                        setDate(e.target.value);
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                />
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    {loading ? t('finance.loading', 'Загрузка...') : t('finance.update', 'Обновить')}
                </button>
            </div>
        </div>
    );
}
