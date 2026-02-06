// apps/web/src/app/staff/finance/components/ShiftSummary.tsx

import type { ShiftCalculations } from '../hooks/useShiftCalculations';
import type { Shift } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

interface ShiftSummaryProps {
    calculations: ShiftCalculations;
    shift: Shift | null;
    isOpen: boolean;
    hourlyRate: number | null;
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
}

export function ShiftSummary({
    calculations,
    shift,
    isOpen,
    hourlyRate,
    currentHoursWorked,
    currentGuaranteedAmount,
}: ShiftSummaryProps) {
    const { t, locale } = useLanguage();

    return (
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
    );
}

