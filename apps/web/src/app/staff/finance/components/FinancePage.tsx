/**
 * РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ СЃС‚СЂР°РЅРёС†С‹ С„РёРЅР°РЅСЃРѕРІ
 * РСЃРїРѕР»СЊР·СѓРµС‚ React Query РґР»СЏ РєСЌС€РёСЂРѕРІР°РЅРёСЏ Рё РѕРїС‚РёРјРёСЃС‚РёС‡РЅС‹С… РѕР±РЅРѕРІР»РµРЅРёР№
 */

'use client';

import { useMemo, useCallback, memo } from 'react';

import { useFinanceData } from '../hooks/useFinanceData';
import { useFinanceDatePrefetch } from '../hooks/useFinanceDatePrefetch';
import { useFinanceLocalItems } from '../hooks/useFinanceLocalItems';
import { useFinanceLoadingState } from '../hooks/useFinanceLoadingState';
import { useFinanceMutations } from '../hooks/useFinanceMutations';
import { useFinancePageState } from '../hooks/useFinancePageState';
import { useServiceOptions } from '../hooks/useServiceOptions';
import { useShiftCalculations } from '../hooks/useShiftCalculations';
import { useShiftStats } from '../hooks/useShiftStats';

import { FinanceClientsTab } from './FinanceClientsTab';
import { FinanceShiftTab } from './FinanceShiftTab';
import { FinanceStatsTab } from './FinanceStatsTab';
import { Tabs } from './Tabs';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { LoadingOverlay } from '@/components/ui/ProgressBar';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

interface FinancePageProps {
    staffId?: string;
    showHeader?: boolean;
}

/**
 * РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ СЃС‚СЂР°РЅРёС†С‹ С„РёРЅР°РЅСЃРѕРІ
 */
export const FinancePage = memo(function FinancePage({ staffId, showHeader = true }: FinancePageProps) {
    const { t } = useLanguage();
    const toast = useToast();

    // РЎРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ РІРєР»Р°РґРѕРє Рё РґР°С‚
    // РЎРѕС…СЂР°РЅСЏРµРј Р°РєС‚РёРІРЅСѓСЋ РІРєР»Р°РґРєСѓ РІ sessionStorage РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РїРѕСЃР»Рµ РїРµСЂРµР·Р°РіСЂСѓР·РєРё
    const {
        activeTab,
        handleTabChange,
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
    } = useFinancePageState(staffId);

    // Р—Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С… С‡РµСЂРµР· React Query
    const financeData = useFinanceData({
        staffId,
        date: shiftDate,
        enabled: true,
    });

    // РњСѓС‚Р°С†РёРё
    const mutations = useFinanceMutations({ staffId, date: shiftDate });

    // РџСЂРµРґР·Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С… РґР»СЏ СЃРѕСЃРµРґРЅРёС… РґР°С‚ РґР»СЏ РјРіРЅРѕРІРµРЅРЅРѕРіРѕ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ
    useFinanceDatePrefetch(shiftDate, staffId);

    const {
        localItems,
        expandedItems,
        setExpandedItems,
        handleAddClient,
        handleUpdateItem,
        handleSaveItem,
        handleDeleteItem,
        handleDuplicateItem,
    } = useFinanceLocalItems({
        serverItems: financeData.data?.items,
        hasFinanceData: !!financeData.data,
        isLoading: financeData.isLoading,
        saveItems: mutations.saveItems,
        t,
        toast,
    });

    // Р’С‹С‡РёСЃР»СЏРµРј СЃРѕСЃС‚РѕСЏРЅРёРµ СЃРјРµРЅС‹
    const shift = financeData.data?.shift ?? null;
    const isOpen = shift?.status === 'open';
    const isClosed = shift?.status === 'closed';

    // Р”Р»СЏ РІР»Р°РґРµР»СЊС†Р°: СЂРµР¶РёРј С‚РѕР»СЊРєРѕ РґР»СЏ С‡С‚РµРЅРёСЏ, РµСЃР»Рё СЃРјРµРЅР° Р·Р°РєСЂС‹С‚Р°
    const isReadOnlyForOwner = !!staffId && isClosed;

    // Р Р°СЃС‡РµС‚С‹ С„РёРЅР°РЅСЃРѕРІ
    const calculations = useShiftCalculations(
        localItems,
        shift,
        isOpen ?? false,
        financeData.data?.staffPercentMaster ?? 60,
        financeData.data?.staffPercentSalon ?? 40,
        financeData.data?.hourlyRate ?? null,
        financeData.data?.currentGuaranteedAmount ?? null
    );

    // РЎС‚Р°С‚РёСЃС‚РёРєР°
    const stats = useShiftStats({
        allShifts: financeData.data?.allShifts ?? [],
        statsPeriod,
        selectedDate,
        selectedMonth,
        selectedYear,
    });

    // РћРїС†РёРё СѓСЃР»СѓРі
    const serviceOptions = useServiceOptions(
        financeData.data?.services ?? [],
        financeData.data?.bookings ?? [],
        localItems
    );

    // Р’С‹С‡РёСЃР»СЏРµРј РѕР±С‰РµРµ РєРѕР»РёС‡РµСЃС‚РІРѕ Р·Р°РєСЂС‹С‚С‹С… СЃРјРµРЅ
    const allClosedShiftsCount = useMemo(() => {
        const allShifts = financeData.data?.allShifts ?? [];
        return allShifts.filter((s) => s.status === 'closed').length;
    }, [financeData.data?.allShifts]);

    // РћР±СЂР°Р±РѕС‚С‡РёРєРё
    const handleOpenShift = useCallback(async () => {
        try {
            await mutations.openShift();
            // invalidateQueries РІ РјСѓС‚Р°С†РёРё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РІС‹Р·РѕРІРµС‚ refetch, РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ РІС‹Р·РѕРІ РЅРµ РЅСѓР¶РµРЅ
        } catch (error) {
            // РћС€РёР±РєР° СѓР¶Рµ РѕР±СЂР°Р±РѕС‚Р°РЅР° РІ РјСѓС‚Р°С†РёРё
        }
    }, [mutations]);

    const handleCloseShift = useCallback(async () => {
        try {
            await mutations.closeShift(localItems);
            // invalidateQueries РІ РјСѓС‚Р°С†РёРё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РІС‹Р·РѕРІРµС‚ refetch, РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ РІС‹Р·РѕРІ РЅРµ РЅСѓР¶РµРЅ
        } catch (error) {
            // РћС€РёР±РєР° СѓР¶Рµ РѕР±СЂР°Р±РѕС‚Р°РЅР° РІ РјСѓС‚Р°С†РёРё
        }
    }, [mutations, localItems]);


    const { shouldShowLoading, loadingMessage } = useFinanceLoadingState({
        isLoading: financeData.isLoading,
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
            
            {/* Р—Р°РіРѕР»РѕРІРѕРє */}
            {showHeader && !staffId && (
                <div className="mb-6 px-6 pt-6">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {t('staff.finance.title', 'Р¤РёРЅР°РЅСЃС‹')}
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('staff.finance.subtitle', 'РЈРїСЂР°РІР»РµРЅРёРµ СЃРјРµРЅРѕР№, РєР»РёРµРЅС‚Р°РјРё Рё С‚РµРј, СЃРєРѕР»СЊРєРѕ РїРѕР»СѓС‡Р°РµС‚ СЃРѕС‚СЂСѓРґРЅРёРє Рё Р±РёР·РЅРµСЃ')}
                    </p>
                </div>
            )}

            <div className={staffId ? '' : 'px-6'}>
                <Tabs
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    itemsCount={localItems.length}
                    showStats={!!stats && !staffId}
                />
            </div>

            {activeTab === 'shift' && (
                <FinanceShiftTab
                    t={t}
                    staffId={staffId}
                    className={`space-y-4 ${staffId ? 'p-6' : 'px-6 pb-6'}`}
                    financeData={financeData}
                    shiftDate={shiftDate}
                    setShiftDate={setShiftDate}
                    shift={shift}
                    isOpen={isOpen ?? false}
                    isClosed={isClosed ?? false}
                    calculations={calculations}
                    localItems={localItems}
                    showShiftDetails={showShiftDetails}
                    setShowShiftDetails={setShowShiftDetails}
                    mutations={mutations}
                    onOpenShift={() => void handleOpenShift()}
                    onCloseShift={() => void handleCloseShift()}
                />
            )}

            {activeTab === 'clients' && (
                <FinanceClientsTab
                    staffId={staffId}
                    className={`space-y-4 ${staffId ? 'p-6' : 'px-6 pb-6'}`}
                    shiftDate={shiftDate}
                    setShiftDate={setShiftDate}
                    isOpen={isOpen ?? false}
                    isClosed={isClosed ?? false}
                    isReadOnly={isReadOnlyForOwner}
                    shift={shift}
                    items={localItems}
                    bookings={financeData.data?.bookings ?? []}
                    serviceOptions={serviceOptions}
                    expandedItems={expandedItems}
                    setExpandedItems={setExpandedItems}
                    onAddClient={handleAddClient}
                    onUpdateItem={handleUpdateItem}
                    onSaveItem={handleSaveItem}
                    onDeleteItem={handleDeleteItem}
                    onDuplicateItem={handleDuplicateItem}
                    mutations={mutations}
                />
            )}

            {activeTab === 'stats' && stats && !staffId && (
                <FinanceStatsTab
                    className={`${staffId ? 'p-6' : 'px-6 pb-6'}`}
                    t={t}
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
            )}
        </>
    );
});


