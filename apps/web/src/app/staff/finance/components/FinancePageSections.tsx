import { Suspense } from 'react';
import type { ReactNode } from 'react';

import type { FinanceData } from '../hooks/useFinanceData';
import type { Shift, ShiftItem, TabKey } from '../types';


import { ClientsList } from './ClientsList';
import { ClientsListHeader } from './ClientsListHeader';
import { ShiftControls } from './ShiftControls';
import { ShiftHeader } from './ShiftHeader';
import { ShiftSummary } from './ShiftSummary';
import { Tabs } from './Tabs';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';

type ShiftCalculations = {
    totalAmount: number;
    totalConsumables: number;
    masterShare: number;
    salonShare: number;
    displayTotalAmount: number;
};

type FinanceHeaderSectionProps = {
    showHeader: boolean;
    staffId?: string;
    title: string;
    subtitle: string;
};

export function FinanceHeaderSection({
    showHeader,
    staffId,
    title,
    subtitle,
}: FinanceHeaderSectionProps) {
    if (!showHeader || staffId) {
        return null;
    }

    return (
        <div className="mb-6 px-6 pt-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
        </div>
    );
}

type FinanceTabsSectionProps = {
    staffId?: string;
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
    itemsCount: number;
    showStats: boolean;
};

export function FinanceTabsSection({
    staffId,
    activeTab,
    onTabChange,
    itemsCount,
    showStats,
}: FinanceTabsSectionProps) {
    return (
        <div className={`min-w-0 ${staffId ? 'px-3 sm:px-4' : 'px-6'}`}>
            <Tabs
                activeTab={activeTab}
                onTabChange={onTabChange}
                itemsCount={itemsCount}
                showStats={showStats}
            />
        </div>
    );
}

type FinanceShiftTabSectionProps = {
    staffId?: string;
    financeData: {
        isError: boolean;
        error: Error | null;
        isLoading: boolean;
        refetch: () => Promise<void>;
        invalidate: () => void;
        data: FinanceData | null;
    };
    shiftDate: Date;
    onShiftDateChange: (date: Date) => void;
    shift: Shift | null;
    todayStatus: 'open' | 'closed' | 'none';
    isOpen: boolean;
    isClosed: boolean;
    calculations: ShiftCalculations;
    localItems: ShiftItem[];
    showShiftDetails: boolean;
    onShowShiftDetails: (show: boolean) => void;
    loadingShiftAction: boolean;
    onOpenShift: () => void;
    onCloseShift: () => void;
    t: (key: string, fallback?: string) => string;
};

export function FinanceShiftTabSection({
    staffId,
    financeData,
    shiftDate,
    onShiftDateChange,
    shift,
    todayStatus,
    isOpen,
    isClosed,
    calculations,
    localItems,
    showShiftDetails,
    onShowShiftDetails,
    loadingShiftAction,
    onOpenShift,
    onCloseShift,
    t,
}: FinanceShiftTabSectionProps) {
    return (
        <div className={`space-y-4 ${staffId ? 'p-4 sm:p-6' : 'px-6 pb-6'}`}>
            {financeData.isError && financeData.error ? (
                <AlertBanner
                    variant="danger"
                    title={t('staff.finance.error.title', 'Ошибка загрузки данных')}
                    message={financeData.error.message}
                    action={
                        <Button type="button" variant="danger" size="sm" onClick={() => void financeData.refetch()}>
                            {t('staff.finance.error.retry', 'Попробовать снова')}
                        </Button>
                    }
                />
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <ShiftHeader
                    shiftDate={shiftDate}
                    onShiftDateChange={onShiftDateChange}
                    shift={shift}
                    status={todayStatus}
                    staffId={staffId}
                />
                <ShiftControls
                    hasShift={!!shift}
                    isOpen={isOpen}
                    isClosed={isClosed}
                    isDayOff={financeData.data?.isDayOff ?? false}
                    loading={financeData.isLoading}
                    saving={loadingShiftAction}
                    staffId={staffId}
                    onOpenShift={onOpenShift}
                    onCloseShift={onCloseShift}
                    onRefresh={() => financeData.invalidate()}
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

            {showShiftDetails && shift && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="grid sm:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                                {t('staff.finance.details.composition', 'Состав оборота')}
                            </h4>
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
                        </div>

                        <div>
                            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                                {t('staff.finance.details.distribution', 'Распределение')}
                            </h4>
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
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onShowShiftDetails(false)}
                        className="mt-4 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                        {t('staff.finance.shift.hideDetails', 'Скрыть детали')}
                    </button>
                </div>
            )}

            {shift && !showShiftDetails && (
                <button
                    type="button"
                    onClick={() => onShowShiftDetails(true)}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                    {t('staff.finance.shift.showDetails', 'Показать детали расчета')}
                </button>
            )}
        </div>
    );
}

type FinanceClientsTabSectionProps = {
    staffId?: string;
    shiftDate: Date;
    onShiftDateChange: (date: Date) => void;
    isOpen: boolean;
    isClosed: boolean;
    isReadOnlyForOwner: boolean;
    isSaving: boolean;
    isShiftActionPending: boolean;
    onAddClient: () => void;
    localItems: ShiftItem[];
    shift: Shift | null;
    hasUnsavedChanges: boolean;
    onSaveNow: () => void;
    bookings: FinanceData['bookings'];
    serviceOptions: FinanceData['services'];
    expandedItems: Set<number>;
    onExpand: (idx: number) => void;
    onCollapse: (idx: number) => void;
    onUpdateItem: (idx: number, item: ShiftItem) => void;
    onSaveItem: (idx: number) => void;
    onDeleteItem: (idx: number) => void;
    onDuplicateItem: (idx: number) => void;
};

export function FinanceClientsTabSection({
    staffId,
    shiftDate,
    onShiftDateChange,
    isOpen,
    isClosed,
    isReadOnlyForOwner,
    isSaving,
    isShiftActionPending,
    onAddClient,
    localItems,
    shift,
    hasUnsavedChanges,
    onSaveNow,
    bookings,
    serviceOptions,
    expandedItems,
    onExpand,
    onCollapse,
    onUpdateItem,
    onSaveItem,
    onDeleteItem,
    onDuplicateItem,
}: FinanceClientsTabSectionProps) {
    return (
        <div className={`space-y-4 ${staffId ? 'p-4 sm:p-6' : 'px-6 pb-6'}`}>
            <ClientsListHeader
                shiftDate={shiftDate}
                onShiftDateChange={onShiftDateChange}
                isOpen={isOpen}
                isClosed={isClosed}
                isReadOnly={isReadOnlyForOwner}
                savingItems={isSaving}
                saving={isShiftActionPending}
                staffId={staffId}
                onAddClient={onAddClient}
                items={localItems}
                shift={shift}
                hasUnsavedChanges={hasUnsavedChanges}
                onSaveNow={onSaveNow}
            />

            <ClientsList
                items={localItems}
                bookings={bookings}
                serviceOptions={serviceOptions}
                shift={shift}
                isOpen={isOpen}
                isClosed={isClosed}
                isReadOnly={isReadOnlyForOwner}
                isSaving={isSaving}
                staffId={staffId}
                expandedItems={expandedItems}
                onExpand={onExpand}
                onCollapse={onCollapse}
                onUpdateItem={onUpdateItem}
                onSaveItem={onSaveItem}
                onDeleteItem={onDeleteItem}
                onDuplicateItem={onDuplicateItem}
            />
        </div>
    );
}

type FinanceStatsTabSectionProps = {
    staffId?: string;
    statsContent: ReactNode;
    loadingLabel: string;
};

export function FinanceStatsTabSection({
    staffId,
    statsContent,
    loadingLabel,
}: FinanceStatsTabSectionProps) {
    return (
        <div className={`${staffId ? 'p-4 sm:p-6' : 'px-6 pb-6'} min-w-0`}>
            <Suspense
                fallback={
                    <div className="flex items-center justify-center py-12">
                        <div className="text-sm text-gray-500 dark:text-gray-400">{loadingLabel}</div>
                    </div>
                }
            >
                {statsContent}
            </Suspense>
        </div>
    );
}
