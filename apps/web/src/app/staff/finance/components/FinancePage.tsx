/**
 * Оптимизированный компонент страницы финансов
 * Использует React Query для кэширования и оптимистичных обновлений
 */

'use client';

import { useState, useCallback, memo, useRef, lazy } from 'react';

import { useFinanceClientAutosave } from '../hooks/useFinanceClientAutosave';
import { useFinanceData } from '../hooks/useFinanceData';
import { useFinanceItemActions } from '../hooks/useFinanceItemActions';
import { useFinanceMutations } from '../hooks/useFinanceMutations';
import { useFinancePageDerivedState } from '../hooks/useFinancePageDerivedState';
import { useFinancePageViewState } from '../hooks/useFinancePageViewState';
import { useFinanceServerSync } from '../hooks/useFinanceServerSync';
import { useFinanceShiftActions } from '../hooks/useFinanceShiftActions';
import { useShiftCalculations } from '../hooks/useShiftCalculations';
import type { ShiftItem } from '../types';
import { prepareShiftItemsForSave, serializeShiftItems } from '../utils/itemLogic';

import {
    FinanceClientsTabSection,
    FinanceHeaderSection,
    FinanceShiftTabSection,
    FinanceStatsTabSection,
    FinanceTabsSection,
} from './FinancePageSections';

// Ленивая загрузка компонента статистики - загружается только при переключении на вкладку "Статистика"
const StatsView = lazy(() => import('./StatsView').then((module) => ({ default: module.StatsView })));

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { LoadingOverlay } from '@/components/ui/ProgressBar';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

interface FinancePageProps {
    staffId?: string;
    showHeader?: boolean;
    /** Данные смены с сервера (SSR prefetch) — сразу отображаются без загрузки */
    initialData?: import('@/app/staff/finance/services/shiftDataService').FinanceResponsePayload;
}

/**
 * Оптимизированный компонент страницы финансов
 */
export const FinancePage = memo(function FinancePage({ staffId, showHeader = true, initialData }: FinancePageProps) {
    const { t } = useLanguage();
    const toast = useToast();

    const {
        activeTab,
        activeTabRef,
        statsPeriod,
        setStatsPeriod,
        shiftDate,
        setShiftDate,
        selectedDate,
        setSelectedDate,
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        showShiftDetails,
        setShowShiftDetails,
        previousTabRef,
        handleTabChange,
    } = useFinancePageViewState({ staffId });

    // Локальное состояние для items (для оптимистичных обновлений)
    const [localItems, setLocalItems] = useState<ShiftItem[]>([]);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    // Отслеживаем, какие элементы были только что сохранены (новые элементы без id)
    const savedItemsWithoutIdRef = useRef<Set<number>>(new Set());
    // Флаг для предотвращения синхронизации сразу после добавления нового элемента
    const skipNextSyncRef = useRef(false);
    // Блокировка повторного добавления клиента (защита от петли при быстрых кликах или двойном срабатывании)
    const addClientLockRef = useRef(false);
    const addClientUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const autoClientLabel = t('staff.finance.clients.client', 'Клиент');

    const prepareItemsForSave = useCallback(
        (items: ShiftItem[]): ShiftItem[] =>
            prepareShiftItemsForSave(items, { autoClientLabel }),
        [autoClientLabel],
    );

    // Загрузка данных через React Query (initialData от SSR убирает первый запрос)
    const financeData = useFinanceData({
        staffId,
        date: shiftDate,
        enabled: true,
        initialData,
    });

    // Мутации
    const mutations = useFinanceMutations({ staffId, date: shiftDate });

    const currentTodayStatus = financeData.data?.todayStatus ?? 'none';
    const currentIsOpen = currentTodayStatus === 'open';
    const currentIsClosed = currentTodayStatus === 'closed';
    const currentIsReadOnlyForOwner = !!staffId && currentIsClosed;

    // Держим в ref актуальные флаги для проверки внутри колбэка дебаунса
    const {
        clearPendingSave,
        handleSaveNow,
        lastSavedSignature,
        markSaved,
    } = useFinanceClientAutosave({
        activeTab,
        activeTabRef,
        previousTabRef,
        localItems,
        isOpen: currentIsOpen,
        isReadOnlyForOwner: currentIsReadOnlyForOwner,
        prepareItemsForSave,
        saveItems: mutations.saveItems,
        serializeItems: serializeShiftItems,
    });

    useFinanceServerSync({
        financeData: financeData.data,
        isLoading: financeData.isLoading,
        setLocalItems,
        setExpandedItems,
        skipNextSyncRef,
        savedItemsWithoutIdRef,
        markSaved,
    });

    const {
        handleAddClient,
        handleUpdateItem,
        handleSaveItem,
        handleDeleteItem,
        handleDuplicateItem,
    } = useFinanceItemActions({
        autoClientLabel,
        localItems,
        setLocalItems,
        setExpandedItems,
        clearPendingSave,
        markSaved,
        mutations,
        prepareItemsForSave,
        toast,
        t,
        savedItemsWithoutIdRef,
        skipNextSyncRef,
        addClientLockRef,
        addClientUnlockTimerRef,
    });

    const {
        allClosedShiftsCount,
        handleCollapseItem,
        handleExpandItem,
        hasUnsavedChanges,
        isClosed,
        isOpen,
        isReadOnlyForOwner,
        serviceOptions,
        shift,
        stats,
        todayStatus,
    } = useFinancePageDerivedState({
        financeData: financeData.data,
        localItems,
        setExpandedItems,
        lastSavedSignature,
        staffId,
        statsPeriod,
        selectedDate,
        selectedMonth,
        selectedYear,
    });

    const calculations = useShiftCalculations(
        localItems,
        shift,
        isOpen ?? false,
        financeData.data?.staffPercentMaster ?? 60,
        financeData.data?.staffPercentSalon ?? 40,
        financeData.data?.hourlyRate ?? null,
        financeData.data?.currentGuaranteedAmount ?? null,
    );

    const {
        handleOpenShift,
        handleCloseShift,
        loadingMessage,
        shouldShowLoading,
    } = useFinanceShiftActions({
        localItems,
        mutations,
        t,
    });

    return (
        <>
            {shouldShowLoading && (
                <LoadingOverlay message={loadingMessage} />
            )}
            <ToastContainer
                toasts={toast.toasts}
                onRemove={toast.removeToast}
            />
            
            <FinanceHeaderSection
                showHeader={showHeader}
                staffId={staffId}
                title={t('staff.finance.title', 'Финансы')}
                subtitle={t('staff.finance.subtitle', 'Управление сменой, клиентами и тем, сколько получает сотрудник и бизнес')}
            />

            <FinanceTabsSection
                staffId={staffId}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                itemsCount={localItems.length}
                showStats={!staffId}
            />

            {activeTab === 'shift' && (
                <FinanceShiftTabSection
                    staffId={staffId}
                    financeData={financeData}
                    shiftDate={shiftDate}
                    onShiftDateChange={setShiftDate}
                    shift={shift}
                    todayStatus={todayStatus}
                    isOpen={isOpen ?? false}
                    isClosed={isClosed ?? false}
                    calculations={calculations}
                    localItems={localItems}
                    showShiftDetails={showShiftDetails}
                    onShowShiftDetails={setShowShiftDetails}
                    loadingShiftAction={mutations.isOpening || mutations.isClosing}
                    onOpenShift={handleOpenShift}
                    onCloseShift={handleCloseShift}
                    t={t}
                />
            )}

            {activeTab === 'clients' && (
                <FinanceClientsTabSection
                    staffId={staffId}
                    shiftDate={shiftDate}
                    onShiftDateChange={setShiftDate}
                    isOpen={isOpen ?? false}
                    isClosed={isClosed ?? false}
                    isReadOnlyForOwner={isReadOnlyForOwner}
                    isSaving={mutations.isSaving}
                    isShiftActionPending={mutations.isOpening || mutations.isClosing}
                    onAddClient={handleAddClient}
                    localItems={localItems}
                    shift={shift}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onSaveNow={handleSaveNow}
                    bookings={financeData.data?.bookings ?? []}
                    serviceOptions={serviceOptions}
                    expandedItems={expandedItems}
                    onExpand={handleExpandItem}
                    onCollapse={handleCollapseItem}
                    onUpdateItem={handleUpdateItem}
                    onSaveItem={handleSaveItem}
                    onDeleteItem={handleDeleteItem}
                    onDuplicateItem={handleDuplicateItem}
                />
            )}

            {activeTab === 'stats' && stats && !staffId && (
                <FinanceStatsTabSection
                    staffId={staffId}
                    loadingLabel={t('staff.finance.stats.loading', 'Загрузка статистики...')}
                    statsContent={
                        <StatsView
                            stats={stats}
                            allShiftsCount={allClosedShiftsCount}
                            statsPeriod={statsPeriod}
                            onPeriodChange={setStatsPeriod}
                            selectedDate={selectedDate}
                            onDateChange={setSelectedDate}
                            selectedMonth={selectedMonth}
                            onMonthChange={setSelectedMonth}
                            selectedYear={selectedYear}
                            onYearChange={setSelectedYear}
                        />
                    }
                />
            )}
        </>
    );
});



