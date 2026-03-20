import type { ReactNode } from 'react';

import type { Shift, ShiftItem } from '../types';

import { ShiftControls } from './ShiftControls';
import { ShiftHeader } from './ShiftHeader';
import { ShiftSummary } from './ShiftSummary';

interface FinanceShiftTabProps {
    t: (key: string, fallback?: string) => string;
    staffId?: string;
    className: string;
    financeData: {
        isError: boolean;
        error: Error | null;
        isLoading: boolean;
        refetch: () => Promise<unknown>;
        invalidate: () => Promise<unknown>;
        data?: {
            isDayOff?: boolean;
            hourlyRate?: number | null;
            currentHoursWorked?: number | null;
            currentGuaranteedAmount?: number | null;
            staffPercentMaster?: number | null;
            staffPercentSalon?: number | null;
        };
    };
    shiftDate: Date;
    setShiftDate: (value: Date) => void;
    shift: Shift | null;
    isOpen: boolean;
    isClosed: boolean;
    calculations: {
        totalAmount: number;
        totalConsumables: number;
        masterShare: number;
        salonShare: number;
    };
    localItems: ShiftItem[];
    showShiftDetails: boolean;
    setShowShiftDetails: (value: boolean) => void;
    mutations: {
        isOpening: boolean;
        isClosing: boolean;
    };
    onOpenShift: () => void;
    onCloseShift: () => void;
}

export function FinanceShiftTab({
    t,
    staffId,
    className,
    financeData,
    shiftDate,
    setShiftDate,
    shift,
    isOpen,
    isClosed,
    calculations,
    localItems,
    showShiftDetails,
    setShowShiftDetails,
    mutations,
    onOpenShift,
    onCloseShift,
}: FinanceShiftTabProps) {
    return (
        <div className={className}>
            {financeData.isError && financeData.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                {t('staff.finance.error.title', 'Ошибка загрузки данных')}
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                {financeData.error.message}
                            </p>
                            <button
                                type="button"
                                onClick={() => void financeData.refetch()}
                                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
                            >
                                {t('staff.finance.error.retry', 'Попробовать снова')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <ShiftHeader
                    shiftDate={shiftDate}
                    onShiftDateChange={setShiftDate}
                    shift={shift}
                    isOpen={isOpen}
                    staffId={staffId}
                />
                <ShiftControls
                    hasShift={!!shift}
                    isOpen={isOpen}
                    isClosed={isClosed}
                    isDayOff={financeData.data?.isDayOff ?? false}
                    loading={financeData.isLoading}
                    saving={mutations.isOpening || mutations.isClosing}
                    staffId={staffId}
                    onOpenShift={onOpenShift}
                    onCloseShift={onCloseShift}
                    onRefresh={() => void financeData.invalidate()}
                />
            </div>

            {shift && (
                <ShiftSummary
                    calculations={calculations}
                    shift={shift}
                    isOpen={isOpen}
                    hourlyRate={financeData.data?.hourlyRate ?? null}
                    currentHoursWorked={financeData.data?.currentHoursWorked ?? null}
                    currentGuaranteedAmount={financeData.data?.currentGuaranteedAmount ?? null}
                    items={localItems}
                    shiftDate={shiftDate}
                />
            )}

            {shift && showShiftDetails && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="grid sm:grid-cols-2 gap-6">
                        <FinanceShiftDetailBlock
                            title={t('staff.finance.details.composition', 'Состав оборота')}
                            content={
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">{t('staff.finance.details.serviceAmount', 'Услуги')}</span>
                                        <span className="font-semibold">{calculations.totalAmount.toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">{t('staff.finance.details.consumables', 'Расходники')}</span>
                                        <span className="font-semibold text-amber-600 dark:text-amber-400">{calculations.totalConsumables.toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 font-medium">
                                        <span>{t('staff.finance.details.total', 'Итого')}</span>
                                        <span>{(calculations.totalAmount + calculations.totalConsumables).toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                    </div>
                                </div>
                            }
                        />

                        <FinanceShiftDetailBlock
                            title={t('staff.finance.details.distribution', 'Распределение')}
                            content={
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">
                                            {t('staff.finance.details.staffShare', 'Сотрудник')} <span className="text-xs">({financeData.data?.staffPercentMaster ?? 60}%)</span>
                                        </span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{calculations.masterShare.toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">
                                            {t('staff.finance.details.businessShare', 'Бизнес')} <span className="text-xs">({financeData.data?.staffPercentSalon ?? 40}% + расходники)</span>
                                        </span>
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{calculations.salonShare.toLocaleString('ru-RU')} {t('staff.finance.shift.som', 'сом')}</span>
                                    </div>
                                </div>
                            }
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowShiftDetails(false)}
                        className="mt-4 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                        {t('staff.finance.shift.hideDetails', 'Скрыть детали')}
                    </button>
                </div>
            )}

            {shift && !showShiftDetails && (
                <button
                    type="button"
                    onClick={() => setShowShiftDetails(true)}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                    {t('staff.finance.shift.showDetails', 'Показать детали расчета')}
                </button>
            )}
        </div>
    );
}

function FinanceShiftDetailBlock({ title, content }: { title: string; content: ReactNode }) {
    return (
        <div>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                {title}
            </h4>
            {content}
        </div>
    );
}
