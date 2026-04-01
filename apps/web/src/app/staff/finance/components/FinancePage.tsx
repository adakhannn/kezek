/**
 * РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ СЃС‚СЂР°РЅРёС†С‹ С„РёРЅР°РЅСЃРѕРІ
 * РСЃРїРѕР»СЊР·СѓРµС‚ React Query РґР»СЏ РєСЌС€РёСЂРѕРІР°РЅРёСЏ Рё РѕРїС‚РёРјРёСЃС‚РёС‡РЅС‹С… РѕР±РЅРѕРІР»РµРЅРёР№
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

// Р›РµРЅРёРІР°СЏ Р·Р°РіСЂСѓР·РєР° РєРѕРјРїРѕРЅРµРЅС‚Р° СЃС‚Р°С‚РёСЃС‚РёРєРё - Р·Р°РіСЂСѓР¶Р°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РїРµСЂРµРєР»СЋС‡РµРЅРёРё РЅР° РІРєР»Р°РґРєСѓ "РЎС‚Р°С‚РёСЃС‚РёРєР°"
const StatsView = lazy(() => import('./StatsView').then((module) => ({ default: module.StatsView })));

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { LoadingOverlay } from '@/components/ui/ProgressBar';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

interface FinancePageProps {
    staffId?: string;
    showHeader?: boolean;
    /** Р”Р°РЅРЅС‹Рµ СЃРјРµРЅС‹ СЃ СЃРµСЂРІРµСЂР° (SSR prefetch) вЂ” СЃСЂР°Р·Сѓ РѕС‚РѕР±СЂР°Р¶Р°СЋС‚СЃСЏ Р±РµР· Р·Р°РіСЂСѓР·РєРё */
    initialData?: import('@/app/staff/finance/services/shiftDataService').FinanceResponsePayload;
}

/**
 * РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ СЃС‚СЂР°РЅРёС†С‹ С„РёРЅР°РЅСЃРѕРІ
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

    // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ items (РґР»СЏ РѕРїС‚РёРјРёСЃС‚РёС‡РЅС‹С… РѕР±РЅРѕРІР»РµРЅРёР№)
    const [localItems, setLocalItems] = useState<ShiftItem[]>([]);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    // РћС‚СЃР»РµР¶РёРІР°РµРј, РєР°РєРёРµ СЌР»РµРјРµРЅС‚С‹ Р±С‹Р»Рё С‚РѕР»СЊРєРѕ С‡С‚Рѕ СЃРѕС…СЂР°РЅРµРЅС‹ (РЅРѕРІС‹Рµ СЌР»РµРјРµРЅС‚С‹ Р±РµР· id)
    const savedItemsWithoutIdRef = useRef<Set<number>>(new Set());
    // Р¤Р»Р°Рі РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ РґРѕР±Р°РІР»РµРЅРёСЏ РЅРѕРІРѕРіРѕ СЌР»РµРјРµРЅС‚Р°
    const skipNextSyncRef = useRef(false);
    // Р‘Р»РѕРєРёСЂРѕРІРєР° РїРѕРІС‚РѕСЂРЅРѕРіРѕ РґРѕР±Р°РІР»РµРЅРёСЏ РєР»РёРµРЅС‚Р° (Р·Р°С‰РёС‚Р° РѕС‚ РїРµС‚Р»Рё РїСЂРё Р±С‹СЃС‚СЂС‹С… РєР»РёРєР°С… РёР»Рё РґРІРѕР№РЅРѕРј СЃСЂР°Р±Р°С‚С‹РІР°РЅРёРё)
    const addClientLockRef = useRef(false);
    const addClientUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const autoClientLabel = t('staff.finance.clients.client', 'РљР»РёРµРЅС‚');

    const prepareItemsForSave = useCallback(
        (items: ShiftItem[]): ShiftItem[] =>
            prepareShiftItemsForSave(items, { autoClientLabel }),
        [autoClientLabel],
    );

    // Р—Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С… С‡РµСЂРµР· React Query (initialData РѕС‚ SSR СѓР±РёСЂР°РµС‚ РїРµСЂРІС‹Р№ Р·Р°РїСЂРѕСЃ)
    const financeData = useFinanceData({
        staffId,
        date: shiftDate,
        enabled: true,
        initialData,
    });

    // РњСѓС‚Р°С†РёРё
    const mutations = useFinanceMutations({ staffId, date: shiftDate });

    const currentTodayStatus = financeData.data?.todayStatus ?? 'none';
    const currentIsOpen = currentTodayStatus === 'open';
    const currentIsClosed = currentTodayStatus === 'closed';
    const currentIsReadOnlyForOwner = !!staffId && currentIsClosed;

    // Р”РµСЂР¶РёРј РІ ref Р°РєС‚СѓР°Р»СЊРЅС‹Рµ С„Р»Р°РіРё РґР»СЏ РїСЂРѕРІРµСЂРєРё РІРЅСѓС‚СЂРё РєРѕР»Р±СЌРєР° РґРµР±Р°СѓРЅСЃР°
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
                title={t('staff.finance.title', 'Р¤РёРЅР°РЅСЃС‹')}
                subtitle={t('staff.finance.subtitle', 'РЈРїСЂР°РІР»РµРЅРёРµ СЃРјРµРЅРѕР№, РєР»РёРµРЅС‚Р°РјРё Рё С‚РµРј, СЃРєРѕР»СЊРєРѕ РїРѕР»СѓС‡Р°РµС‚ СЃРѕС‚СЂСѓРґРЅРёРє Рё Р±РёР·РЅРµСЃ')}
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
                    loadingLabel={t('staff.finance.stats.loading', 'Р—Р°РіСЂСѓР·РєР° СЃС‚Р°С‚РёСЃС‚РёРєРё...')}
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


