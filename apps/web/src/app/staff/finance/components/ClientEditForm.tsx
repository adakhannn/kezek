// apps/web/src/app/staff/finance/components/ClientEditForm.tsx

import { formatInTimeZone } from 'date-fns-tz';
import { useState, useEffect, useMemo, useCallback, memo } from 'react';

import type { ShiftItem, Booking, ServiceName } from '../types';
import { deduplicateServiceNameString, getServiceName } from '../utils';
import { validateShiftItem } from '../utils/validation';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { TZ } from '@/lib/time';

interface ClientEditFormProps {
    item: ShiftItem;
    idx: number;
    allItems: ShiftItem[];
    bookings: Booking[];
    serviceOptions: ServiceName[];
    isOpen: boolean;
    isReadOnly: boolean;
    isSaving?: boolean; // Р¤Р»Р°Рі РґР»СЏ Р±Р»РѕРєРёСЂРѕРІРєРё РєРЅРѕРїРєРё СЃРѕС…СЂР°РЅРµРЅРёСЏ
    onUpdate: (idx: number, item: ShiftItem) => void;
    onSave?: (idx: number) => void;
    onCollapse: (idx: number) => void;
}

function ClientEditFormInner({
    item,
    idx,
    allItems,
    bookings,
    serviceOptions,
    isOpen,
    isReadOnly,
    isSaving = false,
    onUpdate,
    onSave,
    onCollapse,
}: ClientEditFormProps) {
    const { t, locale } = useLanguage();
    
    // Р’Р°Р»РёРґР°С†РёСЏ item СЃ debounce РґР»СЏ РёР·Р±РµР¶Р°РЅРёСЏ Р»РёС€РЅРёС… РїСЂРѕРІРµСЂРѕРє
    const [validationErrors, setValidationErrors] = useState<{
        clientName?: string;
        serviceName?: string;
        serviceAmount?: string;
        consumablesAmount?: string;
    }>({});
    
    // РћС‚СЃР»РµР¶РёРІР°РµРј, РєР°РєРёРµ РїРѕР»СЏ Р±С‹Р»Рё "С‚СЂРѕРЅСѓС‚С‹" (РїРѕР»СѓС‡РёР»Рё С„РѕРєСѓСЃ Рё РїРѕС‚РµСЂСЏР»Рё РµРіРѕ)
    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
    
    // Р’Р°Р»РёРґРёСЂСѓРµРј item РїСЂРё РёР·РјРµРЅРµРЅРёРё (СЃ РЅРµР±РѕР»СЊС€РѕР№ Р·Р°РґРµСЂР¶РєРѕР№ РґР»СЏ РёР·Р±РµР¶Р°РЅРёСЏ Р»РёС€РЅРёС… РїСЂРѕРІРµСЂРѕРє)
    // РќРѕ РїРѕРєР°Р·С‹РІР°РµРј РѕС€РёР±РєРё С‚РѕР»СЊРєРѕ РґР»СЏ "С‚СЂРѕРЅСѓС‚С‹С…" РїРѕР»РµР№
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const validation = validateShiftItem(item);
            // РџРѕРєР°Р·С‹РІР°РµРј РѕС€РёР±РєРё С‚РѕР»СЊРєРѕ РґР»СЏ С‚СЂРѕРЅСѓС‚С‹С… РїРѕР»РµР№
            const filteredErrors: typeof validationErrors = {};
            if (touchedFields.has('clientName') && validation.errors.clientName) {
                filteredErrors.clientName = validation.errors.clientName;
            }
            if (touchedFields.has('serviceName') && validation.errors.serviceName) {
                filteredErrors.serviceName = validation.errors.serviceName;
            }
            if (touchedFields.has('serviceAmount') && validation.errors.serviceAmount) {
                filteredErrors.serviceAmount = validation.errors.serviceAmount;
            }
            if (touchedFields.has('consumablesAmount') && validation.errors.consumablesAmount) {
                filteredErrors.consumablesAmount = validation.errors.consumablesAmount;
            }
            setValidationErrors(filteredErrors);
        }, 300); // 300ms debounce
        
        return () => clearTimeout(timeoutId);
    }, [item, touchedFields]);
    
    // РћР±СЂР°Р±РѕС‚С‡РёРє РїРѕС‚РµСЂРё С„РѕРєСѓСЃР° - РїРѕРјРµС‡Р°РµРј РїРѕР»Рµ РєР°Рє "С‚СЂРѕРЅСѓС‚РѕРµ" Рё РІР°Р»РёРґРёСЂСѓРµРј РµРіРѕ
    const handleBlur = useCallback((fieldName: string) => {
        setTouchedFields((prev) => new Set(prev).add(fieldName));
        // РќРµРјРµРґР»РµРЅРЅР°СЏ РІР°Р»РёРґР°С†РёСЏ РїРѕР»СЏ РїСЂРё РїРѕС‚РµСЂРµ С„РѕРєСѓСЃР°
        const validation = validateShiftItem(item);
        setValidationErrors((prev) => ({
            ...prev,
            [fieldName]: validation.errors[fieldName as keyof typeof validation.errors],
        }));
    }, [item]);
    
    // РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё РѕС€РёР±РєРё РІР°Р»РёРґР°С†РёРё (РґР»СЏ РІСЃРµС… РїРѕР»РµР№, РЅРµ С‚РѕР»СЊРєРѕ С‚СЂРѕРЅСѓС‚С‹С…)
    const hasErrors = useMemo(() => {
        const fullValidation = validateShiftItem(item);
        return Object.keys(fullValidation.errors).length > 0;
    }, [item]);

    // РЎРїРёСЃРѕРє РІСЃРµС… С‚РµРєСѓС‰РёС… РѕС€РёР±РѕРє РґР»СЏ Р±Р»РѕРєР° В«РћР±РЅР°СЂСѓР¶РµРЅС‹ РѕС€РёР±РєРё РІР°Р»РёРґР°С†РёРёВ» (С‡С‚РѕР±С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РІРёРґРµР», С‡С‚Рѕ РёРјРµРЅРЅРѕ РёСЃРїСЂР°РІРёС‚СЊ)
    const errorMessagesForSummary = useMemo(() => {
        const validation = validateShiftItem(item);
        const err = validation.errors;
        const list: string[] = [];
        if (err.clientName) list.push(err.clientName);
        if (err.serviceName) list.push(err.serviceName);
        if (err.serviceAmount) list.push(err.serviceAmount);
        if (err.consumablesAmount) list.push(err.consumablesAmount);
        return list;
    }, [item]);

    const handleBookingChange = (bookingId: string | null) => {
        const booking = bookingId ? bookings.find((b) => b.id === bookingId) : null;
        const servicesArray = booking?.services
            ? Array.isArray(booking.services)
                ? booking.services
                : [booking.services]
            : [];
        const serviceLabel =
            servicesArray.length > 0
                ? servicesArray.map((s) => getServiceName(s, locale)).join(' + ')
                : null;
        
        // Р•СЃР»Рё bookingId СѓР±СЂР°РЅ Рё РЅРµС‚ Р±СЂРѕРЅРё, РіРµРЅРµСЂРёСЂСѓРµРј Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РёРјСЏ "РљР»РёРµРЅС‚ N",
        // РёР·Р±РµРіР°СЏ РґСѓР±Р»РёРєР°С‚РѕРІ РїРѕ С‚РµРєСѓС‰РµРјСѓ СЃРїРёСЃРєСѓ РєР»РёРµРЅС‚РѕРІ.
        let newClientName = item.clientName;
        if (!bookingId && !booking) {
            const clientLabel = t('staff.finance.clients.client', 'РљР»РёРµРЅС‚');
            const usedNames = new Set(
                allItems
                    .filter((_, i) => i !== idx)
                    .map((it) => it.clientName)
                    .filter(Boolean) as string[],
            );
            let nextIndex = 1;
            while (usedNames.has(`${clientLabel} ${nextIndex}`)) {
                nextIndex += 1;
            }
            newClientName = `${clientLabel} ${nextIndex}`;
        }
        
        onUpdate(idx, {
            ...item,
            bookingId,
            clientName: booking
                ? booking.client_name || booking.client_phone || item.clientName
                : newClientName,
            serviceName: serviceLabel ?? item.serviceName,
        });
    };

    const handleServiceChange = (serviceName: string) => {
        onUpdate(idx, { ...item, serviceName });
    };

    const handleServiceAmountChange = (serviceAmount: number) => {
        onUpdate(idx, { ...item, serviceAmount });
    };

    const handleConsumablesAmountChange = (consumablesAmount: number) => {
        onUpdate(idx, { ...item, consumablesAmount });
    };

    // Р”Р»СЏ РєР»РёРµРЅС‚РѕРІ Р±РµР· Р±СЂРѕРЅРё (`bookingId` РїСѓСЃС‚РѕР№) РїРѕРґРґРµСЂР¶РёРІР°РµРј РІС‹Р±РѕСЂ РЅРµСЃРєРѕР»СЊРєРёС… СѓСЃР»СѓРі С‡РµСЂРµР· С‡РµРєР±РѕРєСЃС‹.
    const isWalkIn = !item.bookingId;
    const [selectedServiceNames, setSelectedServiceNames] = useState<string[]>(() =>
        item.serviceName ? item.serviceName.split('+').map((s) => s.trim()).filter(Boolean) : []
    );

    // РЎРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµРј Р»РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ С‡РµРєР±РѕРєСЃРѕРІ, РµСЃР»Рё serviceName РѕР±РЅРѕРІРёР»Рё РёР·РІРЅРµ (РЅР°РїСЂРёРјРµСЂ, РїСЂРё Р·Р°РіСЂСѓР·РєРµ РёР· Р‘Р”)
    useEffect(() => {
        const parts = item.serviceName ? item.serviceName.split('+').map((s) => s.trim()).filter(Boolean) : [];
        setSelectedServiceNames(parts);
    }, [item.serviceName]);

    const toggleServiceForWalkIn = (label: string) => {
        if (!isWalkIn || !isOpen || isReadOnly) return;
        setSelectedServiceNames((prev) => {
            const exists = prev.includes(label);
            return exists ? prev.filter((n) => n !== label) : [...prev, label];
        });
    };

    // РџРѕСЃР»Рµ РёР·РјРµРЅРµРЅРёСЏ РЅР°Р±РѕСЂР° С‡РµРєР±РѕРєСЃРѕРІ РѕР±РЅРѕРІР»СЏРµРј serviceName РІ СЂРѕРґРёС‚РµР»Рµ (FinancePage) РѕРґРёРЅ СЂР°Р·, РїРѕСЃР»Рµ СЂРµРЅРґРµСЂР°
    useEffect(() => {
        if (!isWalkIn) return;
        const nextLabel = selectedServiceNames.join(' + ');
        if (nextLabel !== (item.serviceName || '')) {
            handleServiceChange(nextLabel);
        }
    }, [isWalkIn, selectedServiceNames]);

    // РћР±СЂР°Р±РѕС‚РєР° РіРѕСЂСЏС‡РёС… РєР»Р°РІРёС€
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Enter = РЎРѕС…СЂР°РЅРёС‚СЊ (С‚РѕР»СЊРєРѕ РµСЃР»Рё С„РѕСЂРјР° РѕС‚РєСЂС‹С‚Р° Рё РЅРµ РІ СЂРµР¶РёРјРµ С‚РѕР»СЊРєРѕ С‡С‚РµРЅРёСЏ)
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                // РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ С„РѕРєСѓСЃ РЅРµ РІ textarea РёР»Рё РґСЂСѓРіРѕРј СЌР»РµРјРµРЅС‚Рµ, РіРґРµ Enter РёРјРµРµС‚ РґСЂСѓРіРѕРµ Р·РЅР°С‡РµРЅРёРµ
                const target = e.target as HTMLElement;
                if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text')) {
                    // Р•СЃР»Рё РІ С‚РµРєСЃС‚РѕРІРѕРј РїРѕР»Рµ, Enter СЂР°Р±РѕС‚Р°РµС‚ РєР°Рє РѕР±С‹С‡РЅРѕ
                    return;
                }
                
                // РџСЂРµРґРѕС‚РІСЂР°С‰Р°РµРј СЃС‚Р°РЅРґР°СЂС‚РЅРѕРµ РїРѕРІРµРґРµРЅРёРµ
                e.preventDefault();
                e.stopPropagation();
                
                // РЎРѕС…СЂР°РЅСЏРµРј, РµСЃР»Рё РЅРµС‚ РѕС€РёР±РѕРє Рё С„РѕСЂРјР° РѕС‚РєСЂС‹С‚Р°
                if (isOpen && !isReadOnly && !hasErrors && onSave) {
                    void onSave(idx);
                }
            }
            
            // Esc = РћС‚РјРµРЅР°
            if (e.key === 'Escape') {
                // РџСЂРµРґРѕС‚РІСЂР°С‰Р°РµРј СЃС‚Р°РЅРґР°СЂС‚РЅРѕРµ РїРѕРІРµРґРµРЅРёРµ
                e.preventDefault();
                e.stopPropagation();
                
                // Р—Р°РєСЂС‹РІР°РµРј С„РѕСЂРјСѓ
                onCollapse(idx);
            }
        };

        // Р”РѕР±Р°РІР»СЏРµРј РѕР±СЂР°Р±РѕС‚С‡РёРє С‚РѕР»СЊРєРѕ РµСЃР»Рё С„РѕСЂРјР° РѕС‚РєСЂС‹С‚Р°
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => {
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [isOpen, isReadOnly, hasErrors, onSave, onCollapse, idx]);

    const isMultipleServiceSelect = !item.bookingId;
    const serviceSelectValue = isMultipleServiceSelect
        ? (item.serviceName
            ? item.serviceName.split('+').map((part) => part.trim()).filter(Boolean)
            : [])
        : (item.serviceName || '');

    return (
        <div className="p-5 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-gray-900 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 shadow-lg space-y-5">
            <div className="flex items-center justify-between pb-3 border-b-2 border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                        {t('staff.finance.clients.editing', 'Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РєР»РёРµРЅС‚Р°')}
                    </h3>
                </div>
                <button
                    type="button"
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    onClick={() => onCollapse(idx)}
                    title={t('staff.finance.clients.collapse', 'РЎРІРµСЂРЅСѓС‚СЊ')}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Р›РµРІР°СЏ РєРѕР»РѕРЅРєР° */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.finance.clients.client', 'РљР»РёРµРЅС‚')}
                            <span className="text-red-500 ml-1">*</span>
                            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                ({t('staff.finance.clients.clientHint', 'РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ, РµСЃР»Рё РЅРµ РІС‹Р±СЂР°РЅ РёР· Р·Р°РїРёСЃРµР№')})
                            </span>
                        </label>
                        <select
                            className={`w-full rounded-lg border-2 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all shadow-sm hover:shadow ${
                                validationErrors.clientName
                                    ? 'border-red-500 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                                    : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/20'
                            }`}
                            value={item.bookingId ?? ''}
                            onChange={(e) => handleBookingChange(e.target.value || null)}
                            disabled={!isOpen || isReadOnly}
                        >
                            <option value="">{t('staff.finance.clients.selectFromBookings', 'Р’С‹Р±РµСЂРёС‚Рµ РєР»РёРµРЅС‚Р° РёР· Р·Р°РїРёСЃРµР№...')}</option>
                            {bookings.map((b) => {
                                const servicesList = b.services
                                    ? Array.isArray(b.services)
                                        ? b.services
                                        : [b.services]
                                    : [];
                                const clientLabel = b.client_name || b.client_phone || t('staff.finance.clients.client', 'РљР»РёРµРЅС‚');
                                const serviceLabel =
                                    servicesList.length > 0
                                        ? servicesList.map((s) => getServiceName(s, locale)).join(' + ')
                                        : '';
                                const time = formatInTimeZone(new Date(b.start_at), TZ, 'HH:mm');
                                return (
                                    <option key={b.id} value={b.id}>
                                        {clientLabel} - {serviceLabel} ({time})
                                    </option>
                                );
                            })}
                        </select>
                        {!item.bookingId && (
                            <div className="mt-2">
                                <input
                                    type="text"
                                    className={`w-full rounded-lg border-2 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all shadow-sm hover:shadow ${
                                        validationErrors.clientName
                                            ? 'border-red-500 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                                            : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/20'
                                    }`}
                                    value={item.clientName || ''}
                                    onChange={(e) => onUpdate(idx, { ...item, clientName: e.target.value })}
                                    onBlur={() => handleBlur('clientName')}
                                    disabled={!isOpen || isReadOnly}
                                    placeholder={t('staff.finance.clients.clientPlaceholder', 'Р’РІРµРґРёС‚Рµ РёРјСЏ РєР»РёРµРЅС‚Р°')}
                                    maxLength={200}
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {t('staff.finance.clients.walkInHint', 'РРјСЏ С„РѕСЂРјРёСЂСѓРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РґР»СЏ РєР»РёРµРЅС‚РѕРІ В«СЃ СѓР»РёС†С‹В»')}
                                </p>
                            </div>
                        )}
                        {validationErrors.clientName && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                {t(validationErrors.clientName)}
                            </p>
                        )}
                    </div>

                    {/* Р”Р»СЏ РєР»РёРµРЅС‚РѕРІ РР— Р—РђРџРРЎР РІС‹Р±РѕСЂ СѓСЃР»СѓРі РЅРµ РЅСѓР¶РµРЅ вЂ” РѕРЅРё СѓР¶Рµ Р·Р°РґР°РЅС‹ РІ Р±СЂРѕРЅРё.
                        Р‘Р»РѕРє РЅРёР¶Рµ РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РґР»СЏ РєР»РёРµРЅС‚РѕРІ "СЃ СѓР»РёС†С‹". */}
                    {isWalkIn && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                {t('staff.finance.clients.service', 'РЈСЃР»СѓРіР° / РєРѕРјРјРµРЅС‚Р°СЂРёР№')}
                                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                    {t(
                                        'staff.finance.clients.serviceHintMulti',
                                        'РѕС‚РјРµС‚СЊС‚Рµ РѕРґРЅСѓ РёР»Рё РЅРµСЃРєРѕР»СЊРєРѕ СѓСЃР»СѓРі; РѕРЅРё Р±СѓРґСѓС‚ СЃРѕС…СЂР°РЅРµРЅС‹ РІ РѕРґРЅСѓ СЃС‚СЂРѕРєСѓ',
                                    )}
                                </span>
                            </label>

                            {/* Р§РµРєР±РѕРєСЃС‹ РґР»СЏ РІС‹Р±РѕСЂР° РЅРµСЃРєРѕР»СЊРєРёС… СѓСЃР»СѓРі.
                                РСЃРїРѕР»СЊР·СѓРµРј С‚РѕР»СЊРєРѕ Р±Р°Р·РѕРІС‹Рµ СѓСЃР»СѓРіРё (Р±РµР· СѓР¶Рµ СЃРѕСЃС‚Р°РІР»РµРЅРЅС‹С… "A + B"),
                                С‡С‚РѕР±С‹ РЅРµ РґСѓР±Р»РёСЂРѕРІР°С‚СЊ РєРѕРјРїР»РµРєСЃ РєР°Рє РѕС‚РґРµР»СЊРЅС‹Р№ РІР°СЂРёР°РЅС‚. */}
                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    {Array.from(
                                        new Set(
                                            serviceOptions
                                                .map((svc) => getServiceName(svc, locale))
                                                .filter((label) => label && !label.includes('+')),
                                        ),
                                    ).map((label) => {
                                        const checked = selectedServiceNames.includes(label);
                                        return (
                                            <label
                                                key={label}
                                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs border cursor-pointer transition ${
                                                    checked
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={checked}
                                                    onChange={() => toggleServiceForWalkIn(label)}
                                                    disabled={!isOpen || isReadOnly}
                                                />
                                                <span>{label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                        {item.serviceName && (
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                {t('staff.finance.clients.serviceSummary', 'Р’С‹Р±СЂР°РЅРѕ:')} {deduplicateServiceNameString(item.serviceName)}
                                            </p>
                                        )}
                            </div>
                            {validationErrors.serviceName && (
                                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                                    {t(validationErrors.serviceName)}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* РџСЂР°РІР°СЏ РєРѕР»РѕРЅРєР° */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.finance.clients.servicePrice', 'Р¦РµРЅР° Р·Р° СѓСЃР»СѓРіСѓ')}
                            <span className="text-gray-500 ml-1">(СЃРѕРј)</span>
                            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                ({t('staff.finance.clients.amountHint', '0 - 100,000,000')})
                            </span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                max={100000000}
                                step="50"
                                placeholder="0"
                                className={`w-full rounded-lg border-2 bg-white dark:bg-gray-800 px-3 py-2.5 pr-12 text-sm text-right font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all shadow-sm hover:shadow ${
                                    validationErrors.serviceAmount
                                        ? 'border-red-500 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                                        : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/20'
                                }`}
                                value={item.serviceAmount || ''}
                                onChange={(e) => handleServiceAmountChange(Number(e.target.value || 0))}
                                onBlur={() => handleBlur('serviceAmount')}
                                disabled={!isOpen || isReadOnly}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
                                СЃРѕРј
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            {t('staff.finance.clients.consumablesAmount', 'Р Р°СЃС…РѕРґРЅРёРєРё')}
                            <span className="text-gray-500 ml-1">(СЃРѕРј)</span>
                            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                ({t('staff.finance.clients.amountHint', '0 - 100,000,000')})
                            </span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                max={100000000}
                                step="10"
                                placeholder="0"
                                className={`w-full rounded-lg border-2 bg-white dark:bg-gray-800 px-3 py-2.5 pr-12 text-sm text-right font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all shadow-sm hover:shadow ${
                                    validationErrors.consumablesAmount
                                        ? 'border-red-500 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
                                        : 'border-gray-300 dark:border-gray-600 focus:border-amber-500 focus:ring-amber-500/20'
                                }`}
                                value={item.consumablesAmount || ''}
                                onChange={(e) => handleConsumablesAmountChange(Number(e.target.value || 0))}
                                onBlur={() => handleBlur('consumablesAmount')}
                                disabled={!isOpen || isReadOnly}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
                                СЃРѕРј
                            </span>
                        </div>
                        {validationErrors.consumablesAmount && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                {t(validationErrors.consumablesAmount)}
                            </p>
                        )}
                    </div>
                </div>
            </div>
            
            {/* РћР±С‰РµРµ СЃРѕРѕР±С‰РµРЅРёРµ РѕР± РѕС€РёР±РєР°С… РІР°Р»РёРґР°С†РёРё вЂ” РїРѕРєР°Р·С‹РІР°РµРј РІСЃРµ С‚РµРєСѓС‰РёРµ РѕС€РёР±РєРё, С‡С‚РѕР±С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РІРёРґРµР», С‡С‚Рѕ РёСЃРїСЂР°РІРёС‚СЊ */}
            {hasErrors && (
                <AlertBanner
                    variant="danger"
                    title={t('staff.finance.validation.errors', 'РћР±РЅР°СЂСѓР¶РµРЅС‹ РѕС€РёР±РєРё РІР°Р»РёРґР°С†РёРё')}
                    message={errorMessagesForSummary.map((key) => t(key)).join(' • ')}
                    compact
                    className="mt-4"
                />
            )}
            
            {isOpen && !isReadOnly && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-indigo-200 dark:border-indigo-800">
                    <button
                        type="button"
                        className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all shadow-sm hover:shadow"
                        onClick={() => onCollapse(idx)}
                    >
                        {t('staff.finance.clients.cancel', 'РћС‚РјРµРЅР°')}
                    </button>
                    <button
                        type="button"
                        disabled={hasErrors || isSaving}
                        className={`px-5 py-2.5 text-sm font-semibold rounded-lg shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 transform ${
                            hasErrors || isSaving
                                ? 'text-gray-400 bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                                : 'text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg focus:ring-indigo-500 hover:scale-105'
                        }`}
                        onClick={() => {
                            if (hasErrors || isSaving) {
                                return; // РќРµ СЃРѕС…СЂР°РЅСЏРµРј РїСЂРё РЅР°Р»РёС‡РёРё РѕС€РёР±РѕРє РёР»Рё РІРѕ РІСЂРµРјСЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ
                            }
                            if (onSave) {
                                void onSave(idx);
                            } else {
                                onCollapse(idx);
                            }
                        }}
                    >
                        {isSaving 
                            ? t('staff.finance.clients.saving', 'РЎРѕС…СЂР°РЅРµРЅРёРµ...')
                            : t('staff.finance.clients.save', 'РЎРѕС…СЂР°РЅРёС‚СЊ')
                        }
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ С„РѕСЂРјС‹ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РєР»РёРµРЅС‚Р°
 * РњРµРјРѕРёР·РёСЂРѕРІР°РЅ РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ Р»РёС€РЅРёС… СЂРµ-СЂРµРЅРґРµСЂРѕРІ РїСЂРё РёР·РјРµРЅРµРЅРёРё РґСЂСѓРіРёС… СЌР»РµРјРµРЅС‚РѕРІ СЃРїРёСЃРєР°
 */
export const ClientEditForm = memo(ClientEditFormInner, (prevProps: ClientEditFormProps, nextProps: ClientEditFormProps) => {
    // РЎСЂР°РІРЅРёРІР°РµРј С‚РѕР»СЊРєРѕ С‚Рµ РїСЂРѕРїСЃС‹, РєРѕС‚РѕСЂС‹Рµ РІР»РёСЏСЋС‚ РЅР° СЂРµРЅРґРµСЂ
    // Р”Р»СЏ ClientEditForm РІР°Р¶РЅРѕ СЃСЂР°РІРЅРёРІР°С‚СЊ item Р±РѕР»РµРµ РґРµС‚Р°Р»СЊРЅРѕ, С‚Р°Рє РєР°Рє С„РѕСЂРјР° РјРѕР¶РµС‚ Р±С‹С‚СЊ РѕС‚РєСЂС‹С‚Р°
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.clientName === nextProps.item.clientName &&
        prevProps.item.serviceName === nextProps.item.serviceName &&
        prevProps.item.serviceAmount === nextProps.item.serviceAmount &&
        prevProps.item.consumablesAmount === nextProps.item.consumablesAmount &&
        prevProps.item.bookingId === nextProps.item.bookingId &&
        prevProps.item.createdAt === nextProps.item.createdAt &&
        prevProps.idx === nextProps.idx &&
        prevProps.isOpen === nextProps.isOpen &&
        prevProps.isReadOnly === nextProps.isReadOnly &&
        prevProps.isSaving === nextProps.isSaving &&
        // allItems, bookings, serviceOptions РјРѕРіСѓС‚ РёР·РјРµРЅСЏС‚СЊСЃСЏ, РЅРѕ СЌС‚Рѕ СЂРµРґРєРѕ
        // onUpdate, onSave, onCollapse РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ СЃС‚Р°Р±РёР»СЊРЅС‹РјРё С„СѓРЅРєС†РёСЏРјРё РёР· useCallback
        prevProps.allItems.length === nextProps.allItems.length &&
        prevProps.bookings.length === nextProps.bookings.length &&
        prevProps.serviceOptions.length === nextProps.serviceOptions.length
    );
});


