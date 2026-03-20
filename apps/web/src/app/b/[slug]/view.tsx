// apps/web/src/app/b/[slug]/view.tsx
'use client';

import { format } from 'date-fns';
import { enGB } from 'date-fns/locale/en-GB';
import { ru } from 'date-fns/locale/ru';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AuthChoiceModal } from './components/AuthChoiceModal';
import { BookingHeader } from './components/BookingHeader';
import { BookingStepContent } from './components/BookingStepContent';
import { BookingStepNavigation } from './components/BookingStepNavigation';
import { BookingSteps } from './components/BookingSteps';
import { BookingSummary } from './components/BookingSummary';
import { GuestBookingModal } from './components/GuestBookingModal';
import { PromotionsList } from './components/PromotionsList';
import { useBookingAvailability } from './hooks/useBookingAvailability';
import { useBookingAnalytics } from './hooks/useBookingAnalytics';
import { useBookingAuthState } from './hooks/useBookingAuthState';
import { useBookingCreation } from './hooks/useBookingCreation';
import { useBranchPromotions, useClientBookings } from './hooks/useBookingData';
import { useBookingSelectionState } from './hooks/useBookingSelectionState';
import { useBookingSteps } from './hooks/useBookingSteps';
import { useBookingVisibleSlots } from './hooks/useBookingVisibleSlots';
import { useGuestBooking } from './hooks/useGuestBooking';
import { useSlotsLoader } from './hooks/useSlotsLoader';
import { useSlotsRefreshKey } from './hooks/useSlotsRefreshKey';
import { useTemporaryTransfers } from './hooks/useTemporaryTransfers';
import type { Data, Service, Staff } from './types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { logDebug } from '@/lib/log';
import { dateAtTz } from '@/lib/time';
import { transliterate } from '@/lib/transliterate';

// Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С Р В±Р ВµР В·Р С•Р С—Р В°РЎРѓР Р…Р С•Р Вµ Р В»Р С•Р С–Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р С‘Р В· @/lib/log
// debugLog Р С‘ debugWarn РЎС“Р Т‘Р В°Р В»Р ВµР Р…РЎвЂ№ - Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР Вµ logDebug Р С‘ logWarn Р С‘Р В· @/lib/log


export default function BookingForm({ data }: { data: Data }) {
    const { biz, branches, services, staff, promotions: _promotions = [] } = data;
    const {t, locale} = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘Р С‘ Р Т‘Р В»РЎРЏ РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ Р Р…Р В°Р В·Р Р†Р В°Р Р…Р С‘Р в„– (Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С Р Р…РЎС“Р В¶Р Р…РЎвЂ№Р в„– РЎРЏР В·РЎвЂ№Р С”, Р ВµРЎРѓР В»Р С‘ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р…)
    const formatBranchName = (name: string): string => {
        // Р вЂќР В»РЎРЏ РЎвЂћР С‘Р В»Р С‘Р В°Р В»Р С•Р Р† Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµРЎвЂљРЎРѓРЎРЏ РЎвЂљРЎР‚Р В°Р Р…РЎРѓР В»Р С‘РЎвЂљР ВµРЎР‚Р В°РЎвЂ Р С‘РЎРЏ, РЎвЂљР В°Р С” Р С”Р В°Р С” Р Р…Р ВµРЎвЂљ Р С•РЎвЂљР Т‘Р ВµР В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ Р С—Р С•Р В»Р ВµР в„– Р Т‘Р В»РЎРЏ РЎРЏР В·РЎвЂ№Р С”Р С•Р Р†
        if (locale === 'en') {
            return transliterate(name);
        }
        return name;
    };
    
    const _formatServiceName = (service: Service): string => {
        // Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С Р С—Р С•Р В»Р Вµ Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р С–Р С• РЎРЏР В·РЎвЂ№Р С”Р В°, Р ВµРЎРѓР В»Р С‘ Р С•Р Р…Р С• Р В·Р В°Р С—Р С•Р В»Р Р…Р ВµР Р…Р С•
        if (locale === 'en' && service.name_en) {
            return service.name_en;
        }
        if (locale === 'ky' && service.name_ky) {
            return service.name_ky;
        }
        // Р вЂўРЎРѓР В»Р С‘ Р С—Р С•Р В»РЎРЏ Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р С–Р С• РЎРЏР В·РЎвЂ№Р С”Р В° Р Р…Р ВµРЎвЂљ, Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С РЎвЂљРЎР‚Р В°Р Р…РЎРѓР В»Р С‘РЎвЂљР ВµРЎР‚Р В°РЎвЂ Р С‘РЎР‹ Р Т‘Р В»РЎРЏ Р В°Р Р…Р С–Р В»Р С‘Р в„–РЎРѓР С”Р С•Р С–Р С•
        if (locale === 'en') {
            return transliterate(service.name_ru);
        }
        // Р вЂќР В»РЎРЏ РЎР‚РЎС“РЎРѓРЎРѓР С”Р С•Р С–Р С• Р С‘ Р С”РЎвЂ№РЎР‚Р С–РЎвЂ№Р В·РЎРѓР С”Р С•Р С–Р С• (Р ВµРЎРѓР В»Р С‘ name_ky Р Р…Р ВµРЎвЂљ) Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С name_ru
        return service.name_ru;
    };
    
    const _formatStaffName = (name: string): string => {
        // Р СћРЎР‚Р В°Р Р…РЎРѓР В»Р С‘РЎвЂљР ВµРЎР‚Р С‘РЎР‚РЎС“Р ВµР С Р С‘Р СРЎРЏ Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р В° Р Т‘Р В»РЎРЏ Р В°Р Р…Р С–Р В»Р С‘Р в„–РЎРѓР С”Р С•Р С–Р С• РЎРЏР В·РЎвЂ№Р С”Р В°
        if (locale === 'en') {
            return transliterate(name);
        }
        return name;
    };

    // Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р В»Р С•Р С”Р В°Р В»РЎРЉ Р Т‘Р В»РЎРЏ РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ Р Т‘Р В°РЎвЂљ
    const dateLocale = useMemo(() => {
        if (locale === 'en') {
            return enGB;
        }
        // Р вЂќР В»РЎРЏ РЎР‚РЎС“РЎРѓРЎРѓР С”Р С•Р С–Р С• Р С‘ Р С”РЎвЂ№РЎР‚Р С–РЎвЂ№Р В·РЎРѓР С”Р С•Р С–Р С• Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С РЎР‚РЎС“РЎРѓРЎРѓР С”РЎС“РЎР‹ Р В»Р С•Р С”Р В°Р В»РЎРЉ
        // (Р Р† date-fns Р Р…Р ВµРЎвЂљ Р Р†РЎРѓРЎвЂљРЎР‚Р С•Р ВµР Р…Р Р…Р С•Р в„– Р С”Р С‘РЎР‚Р С–Р С‘Р В·РЎРѓР С”Р С•Р в„– Р В»Р С•Р С”Р В°Р В»Р С‘)
        return ru;
    }, [locale]);

    /* ---------- analytics: Р С•Р Т‘Р С‘Р Р… РЎР‚Р В°Р В· Р В·Р В° РЎРѓР ВµРЎРѓРЎРѓР С‘РЎР‹ РІР‚вЂќ РЎРѓРЎвЂљР В°РЎР‚РЎвЂљ Р С—Р С•РЎвЂљР С•Р С”Р В° Р В±РЎР‚Р С•Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ ---------- */
    const bookingAnalytics = useBookingAnalytics({ bizId: biz.id });

    /* ---------- auth ---------- */
    const { isAuthed } = useBookingAuthState();

    /* ---------- Р Р†РЎвЂ№Р В±Р С•РЎР‚ РЎвЂћР С‘Р В»Р С‘Р В°Р В»Р В°/РЎС“РЎРѓР В»РЎС“Р С–Р С‘/Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р В° ---------- */
    // РЎРѕСЃС‚РѕСЏРЅРёРµ РІС‹Р±РѕСЂР° Рё СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЋ СЃ URL/localStorage РґРµСЂР¶РёРј РІ РѕС‚РґРµР»СЊРЅРѕРј orchestration-hook.
    const {
        branchId,
        setBranchId,
        serviceId,
        setServiceId,
        staffId,
        setStaffId,
        day,
        setDay,
        dayStr,
        todayStr,
        maxStr,
        businessTz,
        servicesByBranch,
        staffByBranch,
        persistSelectionForAuth,
        syncSelectionToUrl,
    } = useBookingSelectionState({
        bizId: biz.id,
        bizTz: biz.tz,
        branches,
        services,
        staff,
        pathname,
        router,
        searchParams,
    });


    // Р С›РЎвЂљРЎРѓР В»Р ВµР В¶Р С‘Р Р†Р В°Р Р…Р С‘Р Вµ Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р В° Р В±Р С‘Р В·Р Р…Р ВµРЎРѓР В°
    // Р вЂ”Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С Р В°Р С”РЎвЂљР С‘Р Р†Р Р…РЎвЂ№Р Вµ Р В°Р С”РЎвЂ Р С‘Р С‘ РЎвЂћР С‘Р В»Р С‘Р В°Р В»Р В° РЎРѓ Р С”РЎРЊРЎв‚¬Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р ВµР С РЎвЂЎР ВµРЎР‚Р ВµР В· React Query
    const { data: branchPromotions = [], isLoading: _promotionsLoading } = useBranchPromotions(branchId || null);


    const { temporaryTransfers } = useTemporaryTransfers({
        branchId,
        bizId: biz.id,
        businessTz,
        staff,
    });

    const {
        serviceStaff,
        staffForSchedule,
        servicesFiltered,
        staffFiltered,
        service,
    } = useBookingAvailability({
        bizId: biz.id,
        branchId,
        dayStr,
        serviceId,
        staffId,
        staff,
        services,
        servicesByBranch,
        staffByBranch,
        temporaryTransfers,
        onInvalidService: () => {
            setServiceId('');
        },
    });


    const { slotsRefreshKey, bumpSlotsRefreshKey } = useSlotsRefreshKey({ serviceId, staffId, dayStr }); // Р С™Р В»РЎР‹РЎвЂЎ Р Т‘Р В»РЎРЏ Р С—РЎР‚Р С‘Р Р…РЎС“Р Т‘Р С‘РЎвЂљР ВµР В»РЎРЉР Р…Р С•Р С–Р С• Р С•Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ

    // Р вЂРЎР‚Р С•Р Р…Р С‘ Р С”Р В»Р С‘Р ВµР Р…РЎвЂљР В° Р Р† РЎРЊРЎвЂљР С•Р С Р В±Р С‘Р В·Р Р…Р ВµРЎРѓР Вµ Р Р…Р В° Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…РЎвЂ№Р в„– Р Т‘Р ВµР Р…РЎРЉ (Р Т‘Р В»РЎРЏ Р СРЎРЏР С–Р С”Р С•Р С–Р С• РЎС“Р Р†Р ВµР Т‘Р С•Р СР В»Р ВµР Р…Р С‘РЎРЏ)
    // Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С React Query Р Т‘Р В»РЎРЏ Р С”РЎРЊРЎв‚¬Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
    const { data: clientBookingsCount = null, isLoading: clientBookingsLoading } = useClientBookings(
        biz.id,
        dayStr || null,
        isAuthed
    );

    /* ---------- Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В° РЎРѓР В»Р С•РЎвЂљР С•Р Р† ---------- */
    const { slots: slotsFromHook, loading: slotsLoading, error: slotsError } = useSlotsLoader({
        serviceId,
        staffId,
        dayStr,
        branchId,
        bizId: biz.id,
        servicesFiltered,
        serviceStaff,
        temporaryTransfers,
        staff,
        t,
        slotsRefreshKey,
    });

    // Р вЂќР С•Р С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЉР Р…Р В°РЎРЏ РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎРЏ РЎРѓР В»Р С•РЎвЂљР С•Р Р† Р С—Р С• РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“РЎР‹РЎвЂ°Р С‘Р С Р В±РЎР‚Р С•Р Р…РЎРЏР С
    // (Р Р…Р В° РЎРѓР В»РЎС“РЎвЂЎР В°Р в„–, Р ВµРЎРѓР В»Р С‘ RPC Р Р…Р Вµ РЎС“РЎвЂЎР С‘РЎвЂљРЎвЂ№Р Р†Р В°Р ВµРЎвЂљ Р Р†РЎРѓР Вµ РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓРЎвЂ№)
    const { slots } = useBookingVisibleSlots({
        slotsFromHook,
        staffId,
        branchId,
        dayStr,
        temporaryTransfers,
        staffForSchedule,
    });

    const guestBooking = useGuestBooking({
        bizId: biz.id,
        businessTz,
        service,
        staffId,
        branchId,
        t,
        onBookingCreated: () => {
            // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р С”РЎРЊРЎв‚¬ РЎРѓР В»Р С•РЎвЂљР С•Р Р† Р С—Р С•РЎРѓР В»Р Вµ РЎРѓР С•Р В·Р Т‘Р В°Р Р…Р С‘РЎРЏ Р В±РЎР‚Р С•Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
            bumpSlotsRefreshKey();
        },
    });

    // Р РЋР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ Р Т‘Р В»РЎРЏ Р СР С•Р Т‘Р В°Р В»РЎРЉР Р…Р С•Р С–Р С• Р С•Р С”Р Р…Р В° Р Р†РЎвЂ№Р В±Р С•РЎР‚Р В° (Р В°Р Р†РЎвЂљР С•РЎР‚Р С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ Р С‘Р В»Р С‘ Р В·Р В°Р С—Р С‘РЎРѓРЎРЉ Р В±Р ВµР В· РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂ Р С‘Р С‘)
    const [authChoiceModalOpen, setAuthChoiceModalOpen] = useState(false);
    const [selectedSlotTime, setSelectedSlotTime] = useState<Date | null>(null);
    const [selectedSlotStaffId, setSelectedSlotStaffId] = useState<string | null>(null);

    const { createBooking, loading: bookingLoading } = useBookingCreation({
        bizId: biz.id,
        businessTz,
        branchId,
        service,
        staffId,
        isAuthed,
        t,
        onAuthChoiceRequest: (slotTime, slotStaffId) => {
            setSelectedSlotTime(slotTime);
            setSelectedSlotStaffId(slotStaffId || null);
            // Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С staff_id Р С‘Р В· РЎРѓР В»Р С•РЎвЂљР В° Р Т‘Р В»РЎРЏ Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ Р Р† Р СР С•Р Т‘Р В°Р В»РЎРЉР Р…Р С•Р С Р С•Р С”Р Р…Р Вµ
            if (slotStaffId && staffId === 'any') {
                setStaffId(slotStaffId);
            }
            setAuthChoiceModalOpen(true);
        },
        onStaffIdChange: (newStaffId) => {
            setStaffId(newStaffId);
        },
        onBookingCreated: () => {
            // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р С”РЎРЊРЎв‚¬ РЎРѓР В»Р С•РЎвЂљР С•Р Р† Р С—Р С•РЎРѓР В»Р Вµ РЎРѓР С•Р В·Р Т‘Р В°Р Р…Р С‘РЎРЏ Р В±РЎР‚Р С•Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
            bumpSlotsRefreshKey();
        },
    });

    /* ---------- Р С—РЎР‚Р С•Р С‘Р В·Р Р†Р С•Р Т‘Р Р…РЎвЂ№Р Вµ Р В·Р Р…Р В°РЎвЂЎР ВµР Р…Р С‘РЎРЏ Р Т‘Р В»РЎРЏ Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р ВµР Р…Р С‘РЎРЏ ---------- */
    const branch = branches.find((b) => b.id === branchId) ?? null;
    const staffCurrent = staff.find((m) => m.id === staffId) ?? null;
    const serviceCurrent = service;

    function redirectToAuth() {
        if (typeof window === 'undefined') return;
        persistSelectionForAuth(step);
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/auth/sign-in?mode=phone&redirect=${redirect}`;
    }

    const dayLabel = useMemo(() => {
        const dateStr = format(day, 'dd.MM.yyyy', { locale: dateLocale });
        const weekdayStr = format(day, 'EEEE', { locale: dateLocale });
        return `${dateStr} (${weekdayStr})`;
    }, [day, dateLocale]);

    /* ---------- Р С—Р С•РЎв‚¬Р В°Р С–Р С•Р Р†РЎвЂ№Р в„– Р Р†Р С‘Р В·Р В°РЎР‚Р Т‘ ---------- */
    const stepFromUrl = searchParams.get('step');
    const initialStep = useMemo(() => {
        const n = stepFromUrl ? parseInt(stepFromUrl, 10) : NaN;
        return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 1;
    }, [stepFromUrl]);

    const { step, stepsMeta, canGoNext, canGoPrev, goNext, goPrev, totalSteps } = useBookingSteps({
        branchId,
        dayStr,
        staffId,
        serviceId,
        servicesFiltered,
        t,
        initialStep,
    });

    useEffect(() => {
        syncSelectionToUrl(step);
    }, [step, syncSelectionToUrl]);


    const stepIndicatorText = useMemo(
        () =>
            (t('booking.step.indicator', 'Р РЃР В°Р С– {current} Р С‘Р В· {total}') as string)
                .replace('{current}', String(step))
                .replace('{total}', String(totalSteps)),
        [t, step, totalSteps]
    );

    /* ---------- UI ---------- */
    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
                <BookingHeader biz={biz} t={t} />

                {!isAuthed && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                        {t(
                            'booking.needAuth',
                            'Р вЂќР В»РЎРЏ Р В±РЎР‚Р С•Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ Р Р…Р ВµР С•Р В±РЎвЂ¦Р С•Р Т‘Р С‘Р СР С• Р Р†Р С•Р в„–РЎвЂљР С‘ Р С‘Р В»Р С‘ Р В·Р В°РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉРЎРѓРЎРЏ. Р СњР В°Р В¶Р СР С‘РЎвЂљР Вµ Р С”Р Р…Р С•Р С—Р С”РЎС“ Р’В«Р вЂ™Р С•Р в„–РЎвЂљР С‘Р’В» Р Р†Р Р†Р ВµРЎР‚РЎвЂ¦РЎС“ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎвЂ№.'
                        )}
                    </div>
                )}
                
                {branchId && branchPromotions.length > 0 && (
                    <PromotionsList promotions={branchPromotions} t={t} />
                )}

                <BookingSteps stepsMeta={stepsMeta} step={step} totalSteps={totalSteps} canGoNext={canGoNext} goPrev={goPrev} stepIndicatorText={stepIndicatorText} />

                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                    <div className="space-y-4">
                        {/* Р РЃР В°Р С– 1: РЎвЂћР С‘Р В»Р С‘Р В°Р В» */}
                        <BookingStepContent
                            step={step}
                            branches={branches}
                            branchId={branchId}
                            dayStr={dayStr}
                            dayLabel={dayLabel}
                            todayStr={todayStr}
                            maxStr={maxStr}
                            staffFiltered={staffFiltered}
                            staffId={staffId}
                            servicesFiltered={servicesFiltered}
                            serviceId={serviceId}
                            serviceCurrent={serviceCurrent}
                            slots={slots}
                            slotsLoading={slotsLoading}
                            slotsError={slotsError}
                            staff={staff}
                            serviceStaff={serviceStaff}
                            isAuthed={isAuthed}
                            clientBookingsCount={clientBookingsCount}
                            clientBookingsLoading={clientBookingsLoading}
                            bookingLoading={bookingLoading}
                            t={t}
                            formatBranchName={formatBranchName}
                            onBranchSelect={(id) => {
                                setBranchId(id);
                                bookingAnalytics.trackBranchSelected(id);
                            }}
                            onDaySelect={(value) => {
                                setDay(dateAtTz(value, '00:00', businessTz));
                                bookingAnalytics.trackDaySelected(branchId || undefined);
                            }}
                            onStaffSelect={(id) => {
                                setStaffId(id);
                                bookingAnalytics.trackStaffSelected(id, branchId || undefined);
                            }}
                            onServiceSelect={(id) => {
                                logDebug('Booking', 'Service clicked', {
                                    serviceId: id,
                                    currentServiceId: serviceId,
                                });
                                setServiceId(id);
                                bookingAnalytics.trackServiceSelected(id, branchId || undefined, staffId || undefined);
                            }}
                            onSlotSelect={(slotTime, slotStaffId) => {
                                bookingAnalytics.trackSlotSelected({
                                    slotTime,
                                    branchId: branchId || undefined,
                                    serviceId: serviceId || undefined,
                                    selectedStaffId: staffId || undefined,
                                    slotStaffId,
                                });
                                createBooking(slotTime, slotStaffId);
                            }}
                        />

                        {/* Р РЃР В°Р С– 2: Р Т‘Р ВµР Р…РЎРЉ */}
                        <BookingStepNavigation
                            canGoPrev={canGoPrev}
                            canGoNext={canGoNext}
                            goPrev={goPrev}
                            goNext={goNext}
                            step={step}
                            totalSteps={totalSteps}
                            t={t}
                        />
                    </div>

                    {/* Р С™Р С•РЎР‚Р В·Р С‘Р Р…Р В° / Р С‘РЎвЂљР С•Р С– */}
                    <BookingSummary
                        branchName={branch ? formatBranchName(branch.name) : null}
                        dayLabel={dayLabel}
                        staffCurrent={staffCurrent}
                        serviceCurrent={serviceCurrent}
                        branchId={branchId}
                        branchPromotions={branchPromotions}
                        isAuthed={isAuthed}
                    />
                </div>
            </div>
            
            <AuthChoiceModal
                isOpen={authChoiceModalOpen}
                onClose={() => {
                    setAuthChoiceModalOpen(false);
                    setSelectedSlotTime(null);
                    setSelectedSlotStaffId(null);
                }}
                onAuth={() => {
                    redirectToAuth();
                }}
                onGuestBooking={() => {
                    if (selectedSlotTime) {
                        guestBooking.openModal(selectedSlotTime, selectedSlotStaffId || undefined);
                    }
                }}
                t={t}
            />
            
            <GuestBookingModal
                isOpen={guestBooking.modalOpen}
                loading={guestBooking.loading}
                form={guestBooking.form}
                onClose={guestBooking.closeModal}
                onFormChange={guestBooking.setForm}
                onSubmit={guestBooking.createGuestBooking}
                t={t}
            />
        </main>
    );
}
