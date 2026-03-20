import type { Period } from './staffFinanceStatsTypes';

type TranslationFn = (key: string, fallback: string) => string;

export function StaffFinanceStatsFilters({
    period,
    setPeriod,
    date,
    setDate,
    loading,
    loadStats,
    t,
}: {
    period: Period;
    setPeriod: (period: Period) => void;
    date: string;
    setDate: (date: string) => void;
    loading: boolean;
    loadStats: () => Promise<void>;
    t: TranslationFn;
}) {
    return (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={() => setPeriod('day')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        period === 'day'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                    }`}
                >
                    {t('finance.period.day', 'День')}
                </button>
                <button
                    onClick={() => setPeriod('month')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        period === 'month'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                    }`}
                >
                    {t('finance.period.month', 'Месяц')}
                </button>
                <button
                    onClick={() => setPeriod('year')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        period === 'year'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                    }`}
                >
                    {t('finance.period.year', 'Год')}
                </button>
            </div>
            <div className="flex items-center gap-2">
                <input
                    type={period === 'year' ? 'number' : period === 'month' ? 'month' : 'date'}
                    value={period === 'year' ? date.split('-')[0] : date}
                    onChange={(e) => {
                        if (period === 'year') {
                            setDate(`${e.target.value}-01-01`);
                        } else {
                            setDate(e.target.value);
                        }
                    }}
                    className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                />
                <button
                    onClick={() => void loadStats()}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? t('finance.loading', 'Загрузка...') : t('finance.update', 'Обновить')}
                </button>
            </div>
        </div>
    );
}
