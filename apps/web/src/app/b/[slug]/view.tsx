// apps/web/src/app/b/[slug]/view.tsx
'use client';

import { enGB } from 'date-fns/locale/en-GB';
import { ru } from 'date-fns/locale/ru';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AuthChoiceModal } from './components/AuthChoiceModal';
import { BookingFormSections } from './components/BookingFormSections';
import { BookingHeader } from './components/BookingHeader';
import { BookingSteps } from './components/BookingSteps';
import { GuestBookingModal } from './components/GuestBookingModal';
import { PromotionsList } from './components/PromotionsList';
import { useBookingCreation } from './hooks/useBookingCreation';
import { useBranchPromotions, useClientBookings, useServiceStaff } from './hooks/useBookingData';
import { useBookingFlowDerived } from './hooks/useBookingFlowDerived';
import { useBookingSelectionState } from './hooks/useBookingSelectionState';
import { useBookingSlotsState } from './hooks/useBookingSlotsState';
import { useBookingSteps } from './hooks/useBookingSteps';
import { useBookingViewerMeta } from './hooks/useBookingViewerMeta';
import { useGuestBooking } from './hooks/useGuestBooking';
import { useServicesFilter } from './hooks/useServicesFilter';
import { useTemporaryTransfers } from './hooks/useTemporaryTransfers';
import type { Data, ServiceStaffRow } from './types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { trackBookingFlowStep } from '@/lib/analyticsTrackEvent';
import { trackFunnelEvent, getSessionId } from '@/lib/funnelEvents';
import { formatStaffName } from '@/lib/i18nHelpers';
import { logDebug, logError } from '@/lib/log';
import { getBusinessTimezone } from '@/lib/time';

// Используем безопасное логирование из @/lib/log
// debugLog и debugWarn удалены - используйте logDebug и logWarn из @/lib/log


export default function BookingForm({ data }: { data: Data }) {
    const { biz, branches, services, staff, promotions: _promotions = [] } = data;
    const {t, locale} = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Тонкие обёртки над shared i18n (formatBranchName = formatStaffName для строк без мультиязычных полей)
    const formatBranchName = (name: string) => formatStaffName(name, locale);

    // Получаем локаль для форматирования дат
    const dateLocale = useMemo(() => {
        if (locale === 'en') {
            return enGB;
        }
        // Для русского и кыргызского используем русскую локаль
        // (в date-fns нет встроенной киргизской локали)
        return ru;
    }, [locale]);

    const { isAuthed } = useBookingViewerMeta(biz.id);

    /* ---------- выбор филиала/услуги/мастера ---------- */
    const {
        branchId,
        day,
        dayStr,
        maxStr,
        restoredFromStorage,
        serviceId,
        serviceIds,
        servicesByBranch,
        setBranchId,
        setDay,
        setServiceIds,
        setStaffId,
        staffByBranch,
        staffId,
        todayStr,
    } = useBookingSelectionState({
        bizId: biz.id,
        bizTz: biz.tz,
        branches,
        searchParams,
        services,
        staff,
    });

    // Загружаем активные акции филиала с кэшированием через React Query
    const { data: branchPromotions = [], isLoading: _promotionsLoading } = useBranchPromotions(branchId || null);

    /* ---------- сервисные навыки мастеров (service_staff) ---------- */
    // Загружаем связи услуга-мастер с кэшированием через React Query
    const staffIds = useMemo(() => staff.map((s) => s.id), [staff]);
    const { data: serviceStaffData, isLoading: serviceStaffLoading } = useServiceStaff(biz.id, staffIds);
    const serviceStaff: ServiceStaffRow[] | null = serviceStaffLoading ? null : (serviceStaffData || null);

    // мапка service_id -> Set(staff_id)
    const serviceToStaffMap = useMemo(() => {
        if (!serviceStaff || serviceStaff.length === 0) return null;
        const map = new Map<string, Set<string>>();
        for (const row of serviceStaff) {
            if (!row.is_active) continue;
            if (!map.has(row.service_id)) map.set(row.service_id, new Set());
            map.get(row.service_id)!.add(row.staff_id);
        }
        return map;
    }, [serviceStaff]);

    /* ---------- дата и слоты через RPC get_free_slots_service_day_v2 ---------- */
    const businessTz = getBusinessTimezone(biz.tz);

    /* ---------- временные переводы сотрудников (staff_schedule_rules) ---------- */
    const { temporaryTransfers } = useTemporaryTransfers({
        branchId,
        bizId: biz.id,
        staff,
    });

    /* ---------- фильтрация услуг (те же правила, что и в QuickDesk: core-domain schedule) ---------- */
    const staffForSchedule = useMemo(
        () => staff.map((s) => ({ id: s.id, branch_id: s.branch_id })),
        [staff],
    );
    const servicesFiltered = useServicesFilter({
        services,
        staffId,
        branchId,
        dayStr,
        staff: staffForSchedule,
        serviceToStaffMap,
        temporaryTransfers,
    });

    // Брони клиента в этом бизнесе на выбранный день (для мягкого уведомления)
    // Используем React Query для кэширования
    const { data: clientBookingsCount = null, isLoading: clientBookingsLoading } = useClientBookings(
        biz.id,
        dayStr || null,
        isAuthed
    );

    const { refreshSlots, slots, slotsError, slotsLoading } = useBookingSlotsState({
        bizId: biz.id,
        branchId,
        dayStr,
        serviceId,
        serviceIds,
        servicesFiltered,
        serviceStaff,
        staff,
        staffForSchedule,
        staffId,
        t,
        temporaryTransfers,
    });

    const {
        dayLabel,
        selectedServicesForStep4,
        serviceCurrent,
        servicesForBooking,
        staffCurrent,
        staffFiltered,
        totalDurationStep4,
        totalPriceFromStep4,
        totalPriceToStep4,
    } = useBookingFlowDerived({
        branchId,
        day,
        dayStr,
        dateLocale,
        serviceId,
        serviceIds,
        services,
        servicesByBranch,
        servicesFiltered,
        setServiceIds,
        staff,
        staffByBranch,
        staffId,
        temporaryTransfers,
    });

    /* ---------- создание бронирования ---------- */

    const guestBooking = useGuestBooking({
        bizId: biz.id,
        services: servicesForBooking,
        staffId,
        branchId,
        t,
        onBookingCreated: () => {
            refreshSlots();
        },
    });

    // Состояние для модального окна выбора (авторизация или запись без регистрации)
    const [authChoiceModalOpen, setAuthChoiceModalOpen] = useState(false);
    const [selectedSlotTime, setSelectedSlotTime] = useState<Date | null>(null);
    const [selectedSlotStaffId, setSelectedSlotStaffId] = useState<string | null>(null);

    const { createBooking, loading: bookingLoading } = useBookingCreation({
        bizId: biz.id,
        branchId,
        services: servicesForBooking,
        staffId,
        isAuthed,
        t,
        onAuthChoiceRequest: (slotTime, slotStaffId) => {
            setSelectedSlotTime(slotTime);
            setSelectedSlotStaffId(slotStaffId || null);
            // Сохраняем staff_id из слота для использования в модальном окне
            if (slotStaffId && staffId === 'any') {
                setStaffId(slotStaffId);
            }
            setAuthChoiceModalOpen(true);
        },
        onStaffIdChange: (newStaffId) => {
            setStaffId(newStaffId);
        },
        onBookingCreated: () => {
            // Обновляем кэш слотов после создания бронирования
            refreshSlots();
        },
    });

    function redirectToAuth() {
        if (typeof window === 'undefined') return;
        try {
            const key = `booking_state_${biz.id}`;
            const payload = {
                branchId,
                serviceIds,
                staffId,
                day: dayStr,
                step,
            };
            window.localStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {
            logError('Booking', 'save booking state failed', e);
        }
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/auth/sign-in?mode=phone&redirect=${redirect}`;
    }

    /* ---------- пошаговый визард ---------- */
    const stepFromUrl = searchParams.get('step');
    const initialStep = useMemo(() => {
        const n = stepFromUrl ? parseInt(stepFromUrl, 10) : NaN;
        return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 1;
    }, [stepFromUrl]);

    const { step, stepsMeta, canGoNext, canGoPrev, goNext, goPrev, totalSteps } = useBookingSteps({
        branchId,
        dayStr,
        staffId,
        serviceIds,
        servicesFiltered,
        t,
        initialStep,
    });

    // Синхронизация прогресса бронирования с URL (сохранение при обновлении страницы)
    useEffect(() => {
        const next = new URLSearchParams();
        next.set('step', String(step));
        if (branchId) next.set('branch', branchId);
        if (dayStr) next.set('day', dayStr);
        if (staffId) next.set('staff', staffId);
        if (serviceIds.length > 0) {
            serviceIds.forEach((id) => next.append('service', id));
        }
        const q = next.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }, [step, branchId, dayStr, staffId, serviceIds, pathname, router]);

    const stepIndicatorText = useMemo(
        () =>
            (t('booking.step.indicator', 'Шаг {current} из {total}') as string)
                .replace('{current}', String(step))
                .replace('{total}', String(totalSteps)),
        [t, step, totalSteps]
    );

    const handleBranchSelect = (id: string) => {
        setBranchId(id);
        trackBookingFlowStep({ bizId: biz.id, branchId: id, step: 'branch' });
        trackFunnelEvent({
            event_type: 'branch_select',
            source: 'public',
            biz_id: biz.id,
            branch_id: id,
            session_id: getSessionId(),
        });
    };

    const handleDayChange = (nextDay: Date) => {
        setDay(nextDay);
        trackBookingFlowStep({
            bizId: biz.id,
            branchId: branchId || undefined,
            step: 'date',
        });
    };

    const handleStaffSelect = (id: string) => {
        setStaffId(id);
        trackBookingFlowStep({
            bizId: biz.id,
            branchId: branchId || undefined,
            step: 'staff',
            staffId: id === 'any' ? null : id,
        });
        trackFunnelEvent({
            event_type: 'staff_select',
            source: 'public',
            biz_id: biz.id,
            branch_id: branchId || null,
            staff_id: id === 'any' ? null : id,
            session_id: getSessionId(),
        });
    };

    const handleServiceToggle = (id: string) => {
        const next = serviceIds.includes(id)
            ? serviceIds.filter((currentId) => currentId !== id)
            : [...serviceIds, id];

        setServiceIds(next);
        logDebug('Booking', 'Service toggled', { serviceId: id, next });
        trackBookingFlowStep({
            bizId: biz.id,
            branchId: branchId || undefined,
            step: 'service',
            serviceId: id,
        });
        trackFunnelEvent({
            event_type: 'service_select',
            source: 'public',
            biz_id: biz.id,
            branch_id: branchId || null,
            service_id: id,
            service_ids: next,
            services_count: next.length,
            staff_id: staffId === 'any' ? null : staffId || null,
            session_id: getSessionId(),
        });
    };

    const handleSlotSelect = (slotTime: Date, slotStaffId: string) => {
        trackBookingFlowStep({
            bizId: biz.id,
            branchId: branchId || undefined,
            step: 'slot',
        });
        trackFunnelEvent({
            event_type: 'slot_select',
            source: 'public',
            biz_id: biz.id,
            branch_id: branchId || null,
            service_id: serviceId || null,
            service_ids: serviceIds,
            services_count: serviceIds.length,
            staff_id: slotStaffId || staffId === 'any' ? null : staffId || null,
            slot_start_at: slotTime.toISOString(),
            session_id: getSessionId(),
        });
        createBooking(slotTime, slotStaffId);
    };

    /* ---------- UI ---------- */
    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
                <BookingHeader biz={biz} t={t} />

                {!isAuthed && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                        {t(
                            'booking.needAuth',
                            'Для бронирования необходимо войти или зарегистрироваться. Нажмите кнопку «Войти» вверху страницы.'
                        )}
                    </div>
                )}
                
                {branchId && branchPromotions.length > 0 && (
                    <PromotionsList promotions={branchPromotions} t={t} />
                )}

                <BookingSteps stepsMeta={stepsMeta} step={step} totalSteps={totalSteps} canGoNext={canGoNext} goPrev={goPrev} stepIndicatorText={stepIndicatorText} />

                <BookingFormSections
                    bizId={biz.id}
                    branchId={branchId}
                    branches={branches}
                    branchPromotions={branchPromotions}
                    businessTz={businessTz}
                    canGoNext={canGoNext}
                    canGoPrev={canGoPrev}
                    clientBookingsCount={clientBookingsCount}
                    clientBookingsLoading={clientBookingsLoading}
                    createBooking={createBooking}
                    day={day}
                    dayLabel={dayLabel}
                    dayStr={dayStr}
                    formatBranchName={formatBranchName}
                    goNext={goNext}
                    goPrev={goPrev}
                    isAuthed={isAuthed}
                    bookingLoading={bookingLoading}
                    serviceCurrent={serviceCurrent}
                    serviceId={serviceId}
                    serviceIds={serviceIds}
                    serviceStaff={serviceStaff}
                    servicesFiltered={servicesFiltered}
                    selectedServicesForStep4={selectedServicesForStep4}
                    slots={slots}
                    slotsError={slotsError}
                    slotsLoading={slotsLoading}
                    staff={staff}
                    staffCurrent={staffCurrent}
                    staffFiltered={staffFiltered}
                    staffId={staffId}
                    step={step}
                    t={t}
                    totalDurationStep4={totalDurationStep4}
                    totalPriceFromStep4={totalPriceFromStep4}
                    totalPriceToStep4={totalPriceToStep4}
                    totalSteps={totalSteps}
                    onBranchSelect={handleBranchSelect}
                    onDayChange={handleDayChange}
                    onServiceToggle={handleServiceToggle}
                    onSlotSelect={handleSlotSelect}
                    onStaffSelect={handleStaffSelect}
                />
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
