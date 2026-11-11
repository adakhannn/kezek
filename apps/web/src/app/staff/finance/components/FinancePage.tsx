/**
 * Оптимизированный компонент страницы финансов
 * Использует React Query для кэширования и оптимистичных обновлений
 */

'use client';

import { useState, useCallback, memo, useRef, lazy } from 'react';

import { useFinanceClientAutosave } from '../hooks/useFinanceClientAutosave';
import { useFinanceData } from '../hooks/useFinanceData';
import { useFinanceDraft } from '../hooks/useFinanceDraft';
import { useFinanceItemActions } from '../hooks/useFinanceItemActions';
import { useFinanceMutations } from '../hooks/useFinanceMutations';
import { useFinancePageDerivedState } from '../hooks/useFinancePageDerivedState';
import { useFinancePageViewState } from '../hooks/useFinancePageViewState';
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
    viewScope?: string;
    showHeader?: boolean;
    /** Данные смены с сервера (SSR prefetch) — сразу отображаются без загрузки */
    initialData?: import('@/app/staff/finance/services/shiftDataService').FinanceResponsePayload;
}

/**
 * Оптимизированный компонент страницы финансов
 */
export const FinancePage = memo(function FinancePage({ staffId, viewScope, showHeader = true, initialData }: FinancePageProps) {
    const { t } = useLanguage();
    const toast = useToast();

    const {
        activeTab,
        activeTabRef,
        statsPeriod,
        setStatsPeriod,
        shiftDate: requestedShiftDate,
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
    } = useFinancePageViewState({ staffId, viewScope });

    // Локальное состояние для items (для оптимистичных обновлений)
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
        date: requestedShiftDate,
        enabled: true,
        initialData,
    });

    // Мутации
    const transport = useFinanceMutations({ staffId, date: requestedShiftDate });
    const { session, state: draft } = useFinanceDraft(transport, financeData.data, prepareItemsForSave);
    const calendarDate = draft.calendarDate ?? financeData.data?.calendar?.date;
    const shiftDate = calendarDate ? new Date(calendarDate + 'T12:00:00') : requestedShiftDate ?? new Date();
    const localItems = draft.items;
    const setLocalItems = session.setItems;
    const mutations = {
        saveItems: session.save, openShift: session.open, closeShift: session.close,
        isSaving: draft.operation === 'save', isOpening: draft.operation === 'open', isClosing: draft.operation === 'close',
    };
    const viewData = financeData.data && draft.initialized ? {
        ...financeData.data, shift: draft.shift, items: draft.items,
        todayStatus: draft.shift?.status ?? 'none' as const, todayExists: !!draft.shift,
    } : financeData.data;
    const changeShiftDate = (next: Date) => {
        if (session.dirty || draft.blocked || draft.operation) {
            toast.showError('Сначала сохраните черновик или явно загрузите актуальную смену, отказавшись от черновика.');
            return;
        }
        setShiftDate(next);
    };

    const currentTodayStatus = viewData?.todayStatus ?? 'none';
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
        isReadOnlyForOwner: currentIsReadOnlyForOwner || !!draft.blocked || !draft.initialized,
        prepareItemsForSave,
        saveItems: mutations.saveItems,
        serializeItems: serializeShiftItems,
        savedSignature: draft.initialized ? serializeShiftItems(draft.savedItems) : null,
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
        financeData: viewData,
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

            {draft.error && (
                <div role="alert" className="my-4 rounded-lg border border-amber-400 bg-amber-50 p-4 text-slate-900">
                    <p>{draft.error}</p>
                    {draft.blocked && <p>Запись остановлена. Скопируйте нужные изменения перед отказом от черновика.</p>}
                    <button type="button" disabled={!!draft.operation}
                        onClick={() => { clearPendingSave(); void session.reload().catch(() => {}); }}
                        className="mt-2 underline">Отказаться от черновика и загрузить актуальную смену</button>
                </div>
            )}

            {activeTab === 'shift' && (
                <FinanceShiftTabSection
                    staffId={staffId}
                    financeData={financeData}
                    shiftDate={shiftDate}
                    onShiftDateChange={changeShiftDate}
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
                    timezone={financeData.data?.calendar?.timezone}
                    staffId={staffId}
                    shiftDate={shiftDate}
                    onShiftDateChange={changeShiftDate}
                    isOpen={isOpen ?? false}
                    isClosed={isClosed ?? false}
                    isReadOnlyForOwner={isReadOnlyForOwner || draft.operation === 'close' || draft.operation === 'open' || draft.operation === 'reload'}
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



