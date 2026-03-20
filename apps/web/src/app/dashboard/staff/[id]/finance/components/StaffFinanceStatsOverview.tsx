import type { Stats } from './staffFinanceStatsTypes';

type TranslationFn = (key: string, fallback: string) => string;

export function StaffFinanceStatsOverview({
    stats,
    period,
    formatPeriodLabel,
    locale,
    t,
}: {
    stats: Stats;
    period: 'day' | 'month' | 'year';
    formatPeriodLabel: string;
    locale: string;
    t: TranslationFn;
}) {
    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        {t('finance.staffStats.turnover', 'Оборот')}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {stats.totalAmount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-base text-gray-500">сом</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{formatPeriodLabel}</div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg border border-emerald-200 dark:border-emerald-800/50 p-5">
                    <div className="text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">
                        {t('finance.staffStats.toEmployee', 'Доля сотрудника')}
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                        {stats.totalMaster.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-base text-emerald-500">сом</span>
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
                        {stats.totalAmount > 0 ? `${((stats.totalMaster / stats.totalAmount) * 100).toFixed(1)}%` : '0%'}
                    </div>
                    {stats.hasGuaranteedPayment && stats.totalBaseMasterShare !== undefined && stats.totalGuaranteedAmount !== undefined && (
                        <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/50 space-y-1">
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-tight">
                                {t('finance.staffStats.baseShare', 'Базовая доля')}:{' '}
                                <span className="font-medium">
                                    {stats.totalBaseMasterShare.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                                </span>
                            </div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                                {t('finance.staffStats.guaranteedAmount', 'За выход')}:{' '}
                                <span className="font-medium">
                                    +{stats.totalGuaranteedAmount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg border border-indigo-200 dark:border-indigo-800/50 p-5">
                    <div className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">
                        {t('finance.staffStats.toBusiness', 'Доля бизнеса')}
                    </div>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                        {stats.totalSalon.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-base text-indigo-500">сом</span>
                    </div>
                    <div className="text-xs text-indigo-600 dark:text-indigo-400">
                        {stats.totalAmount > 0 ? `${((stats.totalSalon / stats.totalAmount) * 100).toFixed(1)}%` : '0%'}
                    </div>
                </div>
            </div>

            {period === 'day' && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {t('finance.shifts', 'Статус смены')}
                        </div>
                        {stats.openShiftsCount > 0 ? (
                            <>
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                    {t('finance.staffStats.status.open', 'Смена открыта')}
                                </span>
                            </>
                        ) : stats.closedShiftsCount > 0 ? (
                            <>
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gray-400"></span>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {t('finance.staffStats.status.closed', 'Смена закрыта')}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                    {t('finance.staffStats.status.noShift', 'Смена не открыта')}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.shifts', 'Смен')}
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.shiftsCount}
                    </div>
                    {(stats.openShiftsCount > 0 || stats.closedShiftsCount > 0) && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                            {stats.openShiftsCount > 0 && (
                                <span className="text-green-600 dark:text-green-400">
                                    {stats.openShiftsCount} {t('finance.shifts.open', 'откр.')}
                                </span>
                            )}
                            {stats.openShiftsCount > 0 && stats.closedShiftsCount > 0 && ' • '}
                            {stats.closedShiftsCount > 0 && (
                                <span className="text-gray-600 dark:text-gray-400">
                                    {stats.closedShiftsCount} {t('finance.shifts.closed', 'закр.')}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.consumables', 'Расходники')}
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalConsumables.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-xs text-gray-500">сом</span>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.late', 'Опоздания')}
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalLateMinutes} <span className="text-xs text-gray-500">мин</span>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.clients', 'Клиентов')}
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalClients}
                    </div>
                </div>
            </div>
        </>
    );
}
