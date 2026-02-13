// apps/web/src/app/staff/finance/components/ShiftSummary.tsx

import type { ShiftCalculations } from '../hooks/useShiftCalculations';
import type { Shift, ShiftItem } from '../types';
import { exportShiftSummaryToCSV } from '../utils/export';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';

interface ShiftSummaryProps {
    calculations: ShiftCalculations;
    shift: Shift | null;
    isOpen: boolean;
    hourlyRate: number | null;
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
    items: ShiftItem[];
    shiftDate: Date;
}

export function ShiftSummary({
    calculations,
    shift,
    isOpen,
    hourlyRate,
    currentHoursWorked,
    currentGuaranteedAmount,
    items,
    shiftDate,
}: ShiftSummaryProps) {
    const { t, locale } = useLanguage();

    const handleExportSummary = () => {
        exportShiftSummaryToCSV(
            shift,
            {
                displayTotalAmount: calculations.displayTotalAmount,
                masterShare: calculations.masterShare,
                salonShare: calculations.salonShare,
                totalConsumables: calculations.totalConsumables,
            },
            items,
            shiftDate,
            undefined // staff_name не доступен в типе Shift, передается отдельно если нужно
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t('staff.finance.summary.title', 'Сводка по смене')}
                </h3>
                {shift && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportSummary}
                        title={t('staff.finance.summary.export', 'Экспорт сводки в CSV')}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {t('staff.finance.summary.export', 'Экспорт')}
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Общий оборот */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                    {t('staff.finance.summary.totalTurnover', 'Общий оборот')}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {calculations.displayTotalAmount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-base text-gray-500">{t('staff.finance.shift.som', 'сом')}</span>
                </div>
            </div>
            
            {/* Сотруднику */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg border border-emerald-200 dark:border-emerald-800/50 p-4">
                <div className="text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">
                    {t('staff.finance.summary.toStaff', 'Сотруднику')}
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {calculations.masterShare.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-base text-emerald-500">{t('staff.finance.shift.som', 'сом')}</span>
                </div>
                {/* Показываем оплату за выход компактно */}
                {((isOpen && hourlyRate && currentHoursWorked !== null && currentGuaranteedAmount !== null) ||
                    (!isOpen && shift?.hourly_rate && shift.hours_worked !== null && shift.hours_worked !== undefined && shift.guaranteed_amount !== null && shift.guaranteed_amount !== undefined)) && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/50">
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                            {t('staff.finance.shift.guaranteedPayment', 'За выход')}: <span className="font-semibold">
                                {isOpen
                                    ? currentGuaranteedAmount?.toFixed(2) ?? '0.00'
                                    : (shift?.guaranteed_amount ?? 0).toFixed(2)} {t('staff.finance.shift.som', 'сом')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Бизнесу */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg border border-indigo-200 dark:border-indigo-800/50 p-4">
                <div className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">
                    {t('staff.finance.summary.toBusiness', 'Бизнесу')}
                </div>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {calculations.salonShare.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-base text-indigo-500">{t('staff.finance.shift.som', 'сом')}</span>
                </div>
            </div>
            </div>
        </div>
    );
}

