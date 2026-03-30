/**
 * РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ СЃС‚СЂР°РЅРёС†С‹ С„РёРЅР°РЅСЃРѕРІ
 * РСЃРїРѕР»СЊР·СѓРµС‚ React Query РґР»СЏ РєСЌС€РёСЂРѕРІР°РЅРёСЏ Рё РѕРїС‚РёРјРёСЃС‚РёС‡РЅС‹С… РѕР±РЅРѕРІР»РµРЅРёР№
 */

'use client';

import { useMemo, useState, useCallback, memo, useEffect, useRef, lazy } from 'react';

import { useFinanceClientAutosave } from '../hooks/useFinanceClientAutosave';
import { useFinanceData } from '../hooks/useFinanceData';
import { useFinanceMutations } from '../hooks/useFinanceMutations';
import { useFinancePageViewState } from '../hooks/useFinancePageViewState';
import { useServiceOptions } from '../hooks/useServiceOptions';
import { useShiftCalculations } from '../hooks/useShiftCalculations';
import { useShiftStats } from '../hooks/useShiftStats';
import type { ShiftItem } from '../types';
import { validateShiftItem } from '../utils/validation';

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

function serializeShiftItems(items: ShiftItem[]): string {
    // РЎРµСЂРёР°Р»РёР·СѓРµРј С‚РѕР»СЊРєРѕ Р·РЅР°С‡РёРјС‹Рµ РїРѕР»СЏ, С‡С‚РѕР±С‹ РѕС‚СЃР»РµР¶РёРІР°С‚СЊ РёР·РјРµРЅРµРЅРёСЏ РґР»СЏ Р°РІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёСЏ
    return JSON.stringify(
        items.map((it) => ({
            id: it.id ?? null,
            clientName: it.clientName ?? '',
            serviceName: it.serviceName ?? '',
            serviceAmount: it.serviceAmount ?? 0,
            consumablesAmount: it.consumablesAmount ?? 0,
            bookingId: it.bookingId ?? null,
            createdAt: it.createdAt ?? null,
        })),
    );
}

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

    const isAutoClientName = useCallback(
        (name: string | null | undefined): boolean => {
            if (!name) return false;
            const trimmed = name.trim();
            if (!trimmed) return false;
            const clientLabel = t('staff.finance.clients.client', 'РљР»РёРµРЅС‚');
            // РџСЂРѕСЃС‚Р°СЏ РїСЂРѕРІРµСЂРєР°: РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ Р»РѕРєР°Р»РёР·РѕРІР°РЅРЅРѕРіРѕ "РљР»РёРµРЅС‚" Рё Р·Р°РєР°РЅС‡РёРІР°РµС‚СЃСЏ С†РёС„СЂРѕР№
            return trimmed.startsWith(`${clientLabel} `) && /\d+$/.test(trimmed);
        },
        [t],
    );

    const hasMeaningfulData = useCallback(
        (item: ShiftItem): boolean => {
            if (item.id) return true;
            if (item.bookingId) return true;
            if (item.serviceAmount && item.serviceAmount > 0) return true;
            if (item.consumablesAmount && item.consumablesAmount > 0) return true;
            if (item.serviceName && item.serviceName.trim() !== '') return true;
            if (item.clientName && item.clientName.trim() !== '' && !isAutoClientName(item.clientName)) {
                return true;
            }
            return false;
        },
        [isAutoClientName],
    );

    const prepareItemsForSave = useCallback(
        (items: ShiftItem[]): ShiftItem[] => {
            // РћС‚Р±СЂР°СЃС‹РІР°РµРј РїРѕР»РЅРѕСЃС‚СЊСЋ РїСѓСЃС‚С‹Рµ РЅРѕРІС‹Рµ СЌР»РµРјРµРЅС‚С‹ (Р±РµР· id/bookingId Рё Р±РµР· Р·РЅР°С‡РёРјС‹С… РґР°РЅРЅС‹С…)
            return items.filter((item) => hasMeaningfulData(item));
        },
        [hasMeaningfulData],
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
    const mutationsRef = useRef(mutations);
    mutationsRef.current = mutations;

    // Р”РµСЂР¶РёРј РІ ref Р°РєС‚СѓР°Р»СЊРЅС‹Р№ СЃРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ РґР»СЏ РІРѕР·РјРѕР¶РЅРѕРіРѕ flush РїСЂРё СЂР°Р·РјРѕРЅС‚РёСЂРѕРІР°РЅРёРё / СЃРјРµРЅРµ РІРєР»Р°РґРєРё

    // РЎРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµРј Р»РѕРєР°Р»СЊРЅС‹Рµ items СЃ РґР°РЅРЅС‹РјРё РёР· СЃРµСЂРІРµСЂР°
    useEffect(() => {
        // РџСЂРѕРїСѓСЃРєР°РµРј СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЋ, РµСЃР»Рё С‚РѕР»СЊРєРѕ С‡С‚Рѕ РґРѕР±Р°РІРёР»Рё РЅРѕРІС‹Р№ СЌР»РµРјРµРЅС‚
        if (skipNextSyncRef.current) {
            skipNextSyncRef.current = false;
            return;
        }
        
        if (financeData.data?.items) {
            const serverItems = financeData.data.items;
            // РСЃРїРѕР»СЊР·СѓРµРј С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ Р°РєС‚СѓР°Р»СЊРЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ
            setLocalItems((currentLocalItems) => {
                const localItemsWithoutId = currentLocalItems.filter((item) => !item.id);
                const localItemsById = new Map(currentLocalItems.filter((item) => item.id).map((item) => [item.id!, item]));
                
                // РћР±СЉРµРґРёРЅСЏРµРј РґР°РЅРЅС‹Рµ: СЃРѕС…СЂР°РЅСЏРµРј С‚РѕР»СЊРєРѕ С‚Рµ Р»РѕРєР°Р»СЊРЅС‹Рµ СЌР»РµРјРµРЅС‚С‹ Р±РµР· id, РєРѕС‚РѕСЂС‹С… РЅРµС‚ РЅР° СЃРµСЂРІРµСЂРµ
                const mergedItems: ShiftItem[] = [];
                
                // РЎРЅР°С‡Р°Р»Р° РґРѕР±Р°РІР»СЏРµРј СЌР»РµРјРµРЅС‚С‹ СЃ СЃРµСЂРІРµСЂР°
                for (const serverItem of serverItems) {
                    if (serverItem.id) {
                        const localItem = localItemsById.get(serverItem.id);
                        if (localItem) {
                            // РћР±СЉРµРґРёРЅСЏРµРј: РїСЂРёРѕСЂРёС‚РµС‚ Р»РѕРєР°Р»СЊРЅС‹Рј РґР°РЅРЅС‹Рј, РµСЃР»Рё РѕРЅРё РЅРµ РїСѓСЃС‚С‹Рµ
                            mergedItems.push({
                                id: serverItem.id,
                                clientName: (localItem.clientName && localItem.clientName.trim()) || serverItem.clientName || '',
                                serviceName: (localItem.serviceName && localItem.serviceName.trim()) || serverItem.serviceName || '',
                                serviceAmount: localItem.serviceAmount ?? serverItem.serviceAmount ?? 0,
                                consumablesAmount: localItem.consumablesAmount ?? serverItem.consumablesAmount ?? 0,
                                bookingId: localItem.bookingId ?? serverItem.bookingId ?? null,
                                createdAt: localItem.createdAt || serverItem.createdAt || null,
                            });
                        } else {
                            // РќРѕРІС‹Р№ СЌР»РµРјРµРЅС‚ СЃ СЃРµСЂРІРµСЂР° (РЅРµ Р±С‹Р» РІ Р»РѕРєР°Р»СЊРЅС‹С…)
                            mergedItems.push(serverItem);
                        }
                    }
                }
                
                // Р—Р°С‚РµРј РґРѕР±Р°РІР»СЏРµРј Р»РѕРєР°Р»СЊРЅС‹Рµ СЌР»РµРјРµРЅС‚С‹ Р±РµР· id, РєРѕС‚РѕСЂС‹Рµ РµС‰Рµ РЅРµ СЃРѕС…СЂР°РЅРµРЅС‹ РЅР° СЃРµСЂРІРµСЂРµ.
                // РџСЂРѕРІРµСЂСЏРµРј РїРѕ СЃРѕРґРµСЂР¶РёРјРѕРјСѓ (clientName, serviceAmount Рё С‚.Рї.), РќРћ Р‘Р•Р— createdAt:
                // СЃРµСЂРІРµСЂ РїСЂРё РІСЃС‚Р°РІРєРµ РїСЂРѕСЃС‚Р°РІР»СЏРµС‚ СЃРІРѕС‘ created_at, РїРѕСЌС‚РѕРјСѓ СЃСЂР°РІРЅРµРЅРёРµ РїРѕ РІСЂРµРјРµРЅРё
                // Р»РѕРјР°РµС‚ СЃРѕРїРѕСЃС‚Р°РІР»РµРЅРёРµ Рё РїСЂРёРІРѕРґРёС‚ Рє РґСѓР±Р»СЏРј РїРѕСЃР»Рµ РїРµСЂРІРѕРіРѕ СЃРѕС…СЂР°РЅРµРЅРёСЏ/СѓРґР°Р»РµРЅРёСЏ.
                for (const localItemWithoutId of localItemsWithoutId) {
                    // РџСЂРѕРІРµСЂСЏРµРј, РЅРµС‚ Р»Рё РЅР° СЃРµСЂРІРµСЂРµ СЌР»РµРјРµРЅС‚Р° СЃ С‚Р°РєРёРј Р¶Рµ СЃРѕРґРµСЂР¶РёРјС‹Рј
                    const isOnServer = serverItems.some((serverItem) => {
                        if (!serverItem.id) return false;
                        // РЎСЂР°РІРЅРёРІР°РµРј РїРѕ РѕСЃРЅРѕРІРЅС‹Рј РїРѕР»СЏРј
                        return (
                            serverItem.clientName === localItemWithoutId.clientName &&
                            serverItem.serviceName === localItemWithoutId.serviceName &&
                            serverItem.serviceAmount === localItemWithoutId.serviceAmount &&
                            serverItem.consumablesAmount === localItemWithoutId.consumablesAmount &&
                            serverItem.bookingId === localItemWithoutId.bookingId
                        );
                    });
                    
                    // Р”РѕР±Р°РІР»СЏРµРј С‚РѕР»СЊРєРѕ РµСЃР»Рё СЌР»РµРјРµРЅС‚Р° РЅРµС‚ РЅР° СЃРµСЂРІРµСЂРµ
                    if (!isOnServer) {
                        mergedItems.push(localItemWithoutId);
                    }
                }
                
                return mergedItems;
            });

            markSaved(serializeShiftItems(serverItems));
            
            // Р—Р°РєСЂС‹РІР°РµРј РІСЃРµ РѕС‚РєСЂС‹С‚С‹Рµ С„РѕСЂРјС‹ РїРѕСЃР»Рµ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё СЃ СЃРµСЂРІРµСЂРѕРј
            // Р­С‚Рѕ РЅСѓР¶РЅРѕ, С‡С‚РѕР±С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РІРёРґРµР» РѕРєРѕРЅС‡Р°С‚РµР»СЊРЅС‹Р№ СЃРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ
            // Рё С„РѕСЂРјС‹ РЅРµ РѕСЃС‚Р°РІР°Р»РёСЃСЊ РѕС‚РєСЂС‹С‚С‹РјРё СЃ СѓСЃС‚Р°СЂРµРІС€РёРјРё РґР°РЅРЅС‹РјРё
            // Р—Р°РєСЂС‹РІР°РµРј С„РѕСЂРјС‹ С‚РѕР»СЊРєРѕ РµСЃР»Рё Р±С‹Р»Рё СЃРѕС…СЂР°РЅРµРЅС‹ РЅРѕРІС‹Рµ СЌР»РµРјРµРЅС‚С‹ (Р±РµР· id)
            // РёР»Рё РµСЃР»Рё РµСЃС‚СЊ РѕС‚РєСЂС‹С‚С‹Рµ С„РѕСЂРјС‹ (С‡С‚РѕР±С‹ РїРѕРєР°Р·Р°С‚СЊ РѕР±РЅРѕРІР»РµРЅРЅС‹Р№ СЃРїРёСЃРѕРє)
            setExpandedItems((prev) => {
                // Р•СЃР»Рё Р±С‹Р»Рё СЃРѕС…СЂР°РЅРµРЅС‹ РЅРѕРІС‹Рµ СЌР»РµРјРµРЅС‚С‹ РёР»Рё РµСЃС‚СЊ РѕС‚РєСЂС‹С‚С‹Рµ С„РѕСЂРјС‹, Р·Р°РєСЂС‹РІР°РµРј РёС…
                if (savedItemsWithoutIdRef.current.size > 0 || prev.size > 0) {
                    savedItemsWithoutIdRef.current.clear();
                    return new Set();
                }
                return prev;
            });
        } else if (financeData.data && !financeData.isLoading) {
            // Р•СЃР»Рё РґР°РЅРЅС‹С… РЅРµС‚, РЅРѕ Р·Р°РіСЂСѓР·РєР° Р·Р°РІРµСЂС€РµРЅР°, СЃРѕС…СЂР°РЅСЏРµРј С‚РѕР»СЊРєРѕ Р»РѕРєР°Р»СЊРЅС‹Рµ СЌР»РµРјРµРЅС‚С‹ Р±РµР· id
            setLocalItems((currentLocalItems) => {
                const localItemsWithoutId = currentLocalItems.filter((item) => !item.id);
                // РќРµ Р·Р°РєСЂС‹РІР°РµРј С„РѕСЂРјС‹, РµСЃР»Рё РµСЃС‚СЊ Р»РѕРєР°Р»СЊРЅС‹Рµ СЌР»РµРјРµРЅС‚С‹
                if (localItemsWithoutId.length === 0) {
                    setExpandedItems(new Set());
                    savedItemsWithoutIdRef.current.clear();
                }
                return localItemsWithoutId;
            });
        }
    }, [financeData.data?.items, financeData.data, financeData.isLoading]);

    // Р’С‹С‡РёСЃР»СЏРµРј СЃРѕСЃС‚РѕСЏРЅРёРµ СЃРјРµРЅС‹
    const shift = financeData.data?.shift ?? null;
    const todayStatus = financeData.data?.todayStatus ?? 'none';
    const isOpen = todayStatus === 'open';
    const isClosed = todayStatus === 'closed';

    // Р”Р»СЏ РІР»Р°РґРµР»СЊС†Р°: СЂРµР¶РёРј С‚РѕР»СЊРєРѕ РґР»СЏ С‡С‚РµРЅРёСЏ, РµСЃР»Рё СЃРјРµРЅР° Р·Р°РєСЂС‹С‚Р°
    const isReadOnlyForOwner = !!staffId && isClosed;

    // Р”РµСЂР¶РёРј РІ ref Р°РєС‚СѓР°Р»СЊРЅС‹Рµ С„Р»Р°РіРё РґР»СЏ РїСЂРѕРІРµСЂРєРё РІРЅСѓС‚СЂРё РєРѕР»Р±СЌРєР° РґРµР±Р°СѓРЅСЃР°
    const {
        clearPendingSave,
        handleSaveNow,
        lastSavedSignature,
        localItemsRef,
        markSaved,
    } = useFinanceClientAutosave({
        activeTab,
        activeTabRef,
        previousTabRef,
        localItems,
        isOpen,
        isReadOnlyForOwner,
        prepareItemsForSave,
        saveItems: mutations.saveItems,
        serializeItems: serializeShiftItems,
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

    const stats = useShiftStats({
        allShifts: financeData.data?.allShifts ?? [],
        statsPeriod,
        selectedDate,
        selectedMonth,
        selectedYear,
    });

    const serviceOptions = useServiceOptions(
        financeData.data?.services ?? [],
        financeData.data?.bookings ?? [],
        localItems,
    );

    const allClosedShiftsCount = useMemo(() => {
        const allShifts = financeData.data?.allShifts ?? [];
        return allShifts.filter((s) => s.status === 'closed').length;
    }, [financeData.data?.allShifts]);

    const hasUnsavedChanges =
        lastSavedSignature !== null && serializeShiftItems(localItems) !== lastSavedSignature;

    const handleOpenShift = useCallback(async () => {
        try {
            await mutations.openShift();
        } catch (error) {
            // Error is already handled in the mutation layer.
        }
    }, [mutations]);

    const handleCloseShift = useCallback(async () => {
        try {
            await mutations.closeShift(localItems);
        } catch (error) {
            // Error is already handled in the mutation layer.
        }
    }, [mutations, localItems]);

    const handleAddClient = useCallback(() => {
        if (addClientLockRef.current) return;
        addClientLockRef.current = true;
        if (addClientUnlockTimerRef.current) {
            clearTimeout(addClientUnlockTimerRef.current);
        }
        addClientUnlockTimerRef.current = setTimeout(() => {
            addClientLockRef.current = false;
            addClientUnlockTimerRef.current = null;
        }, 500);

        const clientLabel = t('staff.finance.clients.client', 'РљР»РёРµРЅС‚');

        setLocalItems((prev) => {
            const usedNames = new Set(prev.map((it) => it.clientName).filter(Boolean) as string[]);
            let nextIndex = 1;
            while (usedNames.has(`${clientLabel} ${nextIndex}`)) {
                nextIndex += 1;
            }

            const now = Date.now();
            const lastItemTime = prev.length > 0 && prev[0].createdAt
                ? new Date(prev[0].createdAt).getTime()
                : now;
            const timeOffset = (now - lastItemTime < 1000) ? 100 : 0;
            const createdAt = new Date(now + timeOffset).toISOString();

            const newItem: ShiftItem = {
                clientName: `${clientLabel} ${nextIndex}`,
                serviceName: '',
                serviceAmount: 0,
                consumablesAmount: 0,
                bookingId: null,
                createdAt,
            };

            const updatedItems = [newItem, ...prev];
            skipNextSyncRef.current = true;
            return updatedItems;
        });
        setExpandedItems(new Set([0]));
    }, [t]);

    // РћР±РЅРѕРІР»РµРЅРёРµ СЌР»РµРјРµРЅС‚Р° Р±РµР· СЃРѕС…СЂР°РЅРµРЅРёСЏ РЅР° СЃРµСЂРІРµСЂ (С‚РѕР»СЊРєРѕ Р»РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ)
    const handleUpdateItem = useCallback((idx: number, item: ShiftItem) => {
        // РўРѕР»СЊРєРѕ Р»РѕРєР°Р»СЊРЅРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ - Р±РµР· СЃРѕС…СЂР°РЅРµРЅРёСЏ РЅР° СЃРµСЂРІРµСЂ
        setLocalItems((prev) => prev.map((it, i) => (i === idx ? item : it)));
    }, []);

    // РЇРІРЅРѕРµ СЃРѕС…СЂР°РЅРµРЅРёРµ СЌР»РµРјРµРЅС‚Р° РЅР° СЃРµСЂРІРµСЂ (РїСЂРё РєР»РёРєРµ РЅР° РєРЅРѕРїРєСѓ "РЎРѕС…СЂР°РЅРёС‚СЊ")
    const handleSaveItem = useCallback(async (idx: number) => {
        const item = localItems[idx];
        if (!item) return;

        // Р’Р°Р»РёРґРёСЂСѓРµРј СЌР»РµРјРµРЅС‚ РїРµСЂРµРґ СЃРѕС…СЂР°РЅРµРЅРёРµРј
        const validation = validateShiftItem(item);
        
        if (!validation.valid) {
            // РћС€РёР±РєРё РІР°Р»РёРґР°С†РёРё вЂ” РєР»СЋС‡Рё i18n; РїРµСЂРµРІРѕРґРёРј РїСЂРё РїРѕРєР°Р·Рµ
            const errorKeys = Object.values(validation.errors).filter(Boolean);
            if (errorKeys.length > 0) {
                toast.showError(t(errorKeys[0]));
            } else {
                toast.showError(t('staff.finance.validation.errors'));
            }
            return;
        }

        // РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё РґР°РЅРЅС‹Рµ РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ
        const hasData = item.id || 
            item.bookingId || 
            (item.serviceAmount && item.serviceAmount > 0) || 
            (item.consumablesAmount && item.consumablesAmount > 0) ||
            (item.serviceName && item.serviceName.trim() !== '') ||
            (item.clientName && item.clientName.trim() !== '' && !item.clientName.match(/^РљР»РёРµРЅС‚ \d+$/));
        
        if (!hasData) {
            // Р•СЃР»Рё РЅРµС‚ РґР°РЅРЅС‹С…, РїСЂРѕСЃС‚Рѕ Р·Р°РєСЂС‹РІР°РµРј С„РѕСЂРјСѓ
            setExpandedItems((prev) => {
                const next = new Set(prev);
                next.delete(idx);
                return next;
            });
            return;
        }

        try {
            // РџСЂРё СЏРІРЅРѕРј СЃРѕС…СЂР°РЅРµРЅРёРё СЃР±СЂР°СЃС‹РІР°РµРј РѕС‚Р»РѕР¶РµРЅРЅС‹Р№ С‚Р°Р№РјРµСЂ, С‡С‚РѕР±С‹ РЅРµ РґРµР»Р°С‚СЊ Р»РёС€РЅРёР№ Р·Р°РїСЂРѕСЃ
            clearPendingSave();

            // РћС‚РјРµС‡Р°РµРј, С‡С‚Рѕ СЌС‚РѕС‚ СЌР»РµРјРµРЅС‚ Р±С‹Р» СЃРѕС…СЂР°РЅРµРЅ (РµСЃР»Рё РѕРЅ РЅРѕРІС‹Р№, Р±РµР· id)
            const wasNewItem = !item.id;
            if (wasNewItem) {
                savedItemsWithoutIdRef.current.add(idx);
            }
            
            const itemsForSave = prepareItemsForSave(localItems);
            await mutations.saveItems(itemsForSave);

            // РћР±РЅРѕРІР»СЏРµРј СЃРёРіРЅР°С‚СѓСЂСѓ РїРѕСЃР»РµРґРЅРµРіРѕ СѓСЃРїРµС€РЅРѕ СЃРѕС…СЂР°РЅС‘РЅРЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ
            const sig = serializeShiftItems(itemsForSave);
            markSaved(sig);
            
            // РџРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕРіРѕ СЃРѕС…СЂР°РЅРµРЅРёСЏ РІСЃРµРіРґР° Р·Р°РєСЂС‹РІР°РµРј С„РѕСЂРјСѓ СЃСЂР°Р·Сѓ
            // Р­С‚Рѕ РЅСѓР¶РЅРѕ, С‡С‚РѕР±С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РІРёРґРµР» РѕР±РЅРѕРІР»РµРЅРЅС‹Р№ СЃРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ
            setExpandedItems((prev) => {
                const next = new Set(prev);
                next.delete(idx);
                return next;
            });
        } catch (error) {
            // РџСЂРё РѕС€РёР±РєРµ СѓР±РёСЂР°РµРј РёР· СЃРїРёСЃРєР° СЃРѕС…СЂР°РЅРµРЅРЅС‹С…
            savedItemsWithoutIdRef.current.delete(idx);
            // РћС€РёР±РєР° СѓР¶Рµ РѕР±СЂР°Р±РѕС‚Р°РЅР° РІ РјСѓС‚Р°С†РёРё
        }
    }, [localItems, mutations, toast, t]);

    const handleDeleteItem = useCallback(async (idx: number) => {
        const itemToDelete = localItems[idx];
        
        // РћРїС‚РёРјРёСЃС‚РёС‡РЅРѕРµ СѓРґР°Р»РµРЅРёРµ
        setLocalItems((prev) => prev.filter((_, i) => i !== idx));
        setExpandedItems((prev) => {
            const next = new Set(prev);
            next.delete(idx);
            return new Set(Array.from(next).map((i) => i > idx ? i - 1 : i));
        });

        // РЈРґР°Р»СЏРµРј РЅР° СЃРµСЂРІРµСЂРµ
        try {
            clearPendingSave();

            const updatedItemsRaw = localItems.filter((_, i) => i !== idx);
            const updatedItems = prepareItemsForSave(updatedItemsRaw);
            await mutations.saveItems(updatedItems);
            // invalidateQueries РІ РјСѓС‚Р°С†РёРё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РІС‹Р·РѕРІРµС‚ refetch
            const sig = serializeShiftItems(updatedItems);
            markSaved(sig);
        } catch (error) {
            // РћС‚РєР°С‚С‹РІР°РµРј РїСЂРё РѕС€РёР±РєРµ
            setLocalItems((prev) => {
                const result = [...prev];
                result.splice(idx, 0, itemToDelete);
                return result;
            });
        }
    }, [localItems, mutations]);

    const handleDuplicateItem = useCallback((idx: number) => {
        const itemToDuplicate = localItems[idx];
        if (!itemToDuplicate) return;

        // РЎРѕР·РґР°РµРј РєРѕРїРёСЋ СЌР»РµРјРµРЅС‚Р° Р±РµР· id (РЅРѕРІС‹Р№ СЌР»РµРјРµРЅС‚)
        const now = Date.now();
        const lastItemTime = localItems.length > 0 && localItems[0].createdAt
            ? new Date(localItems[0].createdAt).getTime()
            : now;
        const timeOffset = (now - lastItemTime < 1000) ? 100 : 0;
        const createdAt = new Date(now + timeOffset).toISOString();

        const duplicatedItem: ShiftItem = {
            // РЈР±РёСЂР°РµРј id, С‡С‚РѕР±С‹ СЃРѕР·РґР°С‚СЊ РЅРѕРІС‹Р№ СЌР»РµРјРµРЅС‚
            // id: undefined,
            clientName: itemToDuplicate.clientName || '',
            serviceName: itemToDuplicate.serviceName || '',
            serviceAmount: itemToDuplicate.serviceAmount ?? 0,
            consumablesAmount: itemToDuplicate.consumablesAmount ?? 0,
            bookingId: null, // РЈР±РёСЂР°РµРј bookingId, С‚Р°Рє РєР°Рє СЌС‚Рѕ РЅРѕРІР°СЏ Р·Р°РїРёСЃСЊ
            createdAt,
        };

        // Р”РѕР±Р°РІР»СЏРµРј РґСѓР±Р»РёРєР°С‚ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ РёСЃС…РѕРґРЅРѕРіРѕ СЌР»РµРјРµРЅС‚Р°
        setLocalItems((prev) => {
            const result = [...prev];
            result.splice(idx + 1, 0, duplicatedItem);
            return result;
        });

        // РћС‚РєСЂС‹РІР°РµРј С„РѕСЂРјСѓ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РґР»СЏ РґСѓР±Р»РёРєР°С‚Р°
        setExpandedItems((prev) => {
            const next = new Set(prev);
            // РЎРґРІРёРіР°РµРј РІСЃРµ РёРЅРґРµРєСЃС‹ РїРѕСЃР»Рµ idx РЅР° +1
            const shifted = Array.from(next).map((i) => i > idx ? i + 1 : i);
            // Р”РѕР±Р°РІР»СЏРµРј РЅРѕРІС‹Р№ РёРЅРґРµРєСЃ РґР»СЏ РґСѓР±Р»РёРєР°С‚Р°
            shifted.push(idx + 1);
            return new Set(shifted);
        });

        // РџСЂРѕРїСѓСЃРєР°РµРј СЃР»РµРґСѓСЋС‰СѓСЋ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЋ СЃ СЃРµСЂРІРµСЂРѕРј
        skipNextSyncRef.current = true;
    }, [localItems]);

    // РћРїСЂРµРґРµР»СЏРµРј, РЅСѓР¶РЅРѕ Р»Рё РїРѕРєР°Р·С‹РІР°С‚СЊ РёРЅРґРёРєР°С‚РѕСЂ Р·Р°РіСЂСѓР·РєРё.
    // РџРѕРєР°Р·С‹РІР°РµРј С‚РѕР»СЊРєРѕ РїСЂРё РјСѓС‚Р°С†РёСЏС… (РѕС‚РєСЂС‹С‚РёРµ/Р·Р°РєСЂС‹С‚РёРµ СЃРјРµРЅС‹, СЃРѕС…СЂР°РЅРµРЅРёРµ РєР»РёРµРЅС‚Р°),
    // Р° РЅРµ РїСЂРё РїРµСЂРІРѕР№ Р·Р°РіСЂСѓР·РєРµ РґР°РЅРЅС‹С… вЂ” Р·Р° initial loading РѕС‚РІРµС‡Р°РµС‚ skeleton РѕС‚ Next.
    const shouldShowLoading =
        mutations.isOpening ||
        mutations.isClosing ||
        mutations.isSaving;
    
    // РћРїСЂРµРґРµР»СЏРµРј СЃРѕРѕР±С‰РµРЅРёРµ РґР»СЏ Р»РѕР°РґРµСЂР°
    const loadingMessage = useMemo(() => {
        if (mutations.isClosing) {
            return t('staff.finance.shift.closing', 'Р—Р°РєСЂС‹С‚РёРµ СЃРјРµРЅС‹...');
        }
        if (mutations.isOpening) {
            return t('staff.finance.shift.opening', 'РћС‚РєСЂС‹С‚РёРµ СЃРјРµРЅС‹...');
        }
        if (mutations.isSaving) {
            return t('staff.finance.clients.saving', 'РЎРѕС…СЂР°РЅРµРЅРёРµ РєР»РёРµРЅС‚Р°...');
        }
        return t('staff.finance.loading', 'Р—Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С… СЃРјРµРЅС‹...');
    }, [mutations.isClosing, mutations.isOpening, mutations.isSaving, t]);

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
                    onExpand={(idx) => setExpandedItems((prev) => new Set(prev).add(idx))}
                    onCollapse={(idx) => {
                        setExpandedItems((prev) => {
                            const next = new Set(prev);
                            next.delete(idx);
                            return next;
                        });
                    }}
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


