'use client';

import { enGB } from 'date-fns/locale/en-GB';
import { ru } from 'date-fns/locale/ru';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AuthChoiceModal } from './components/AuthChoiceModal';
import { BookingConfirmModal } from './components/BookingConfirmModal';
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
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Card } from '@/components/ui/Card';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { trackBookingFlowStep } from '@/lib/analyticsTrackEvent';
import { resolvePublicContacts } from '@/lib/businessContacts';
import { getSessionId, trackFunnelEvent } from '@/lib/funnelEvents';
import { formatStaffName } from '@/lib/i18nHelpers';
import { logDebug, logError } from '@/lib/log';
import { getBusinessTimezone, toLabel } from '@/lib/time';

export default function BookingForm({ data }: { data: Data }) {
    const { biz, branches, services, staff } = data;
    const { t, locale } = useLanguage();
    const toast = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const formatBranchName = (name: string) => formatStaffName(name, locale);

    const dateLocale = useMemo(() => {
        if (locale === 'en') {
            return enGB;
        }
        return ru;
    }, [locale]);

    const { isAuthed } = useBookingViewerMeta(biz.id);

    const {
        branchId,
        day,
        dayStr,
        serviceId,
        serviceIds,
        servicesByBranch,
        setBranchId,
        setDay,
        setServiceIds,
        setStaffId,
        staffByBranch,
        staffId,
    } = useBookingSelectionState({
        bizId: biz.id,
        bizTz: biz.tz,
        branches,
        searchParams,
        services,
        staff,
    });

    const { data: branchPromotions = [] } = useBranchPromotions(branchId || null);
    const selectedBranch = useMemo(
        () => branches.find((branch) => branch.id === branchId) ?? null,
        [branchId, branches],
    );
    const publicContacts = useMemo(
        () => resolvePublicContacts(biz, selectedBranch),
        [biz, selectedBranch],
    );

    const staffIds = useMemo(() => staff.map((person) => person.id), [staff]);
    const { data: serviceStaffData, isLoading: serviceStaffLoading } = useServiceStaff(biz.id, staffIds);
    const serviceStaff: ServiceStaffRow[] | null = serviceStaffLoading ? null : (serviceStaffData || null);

    const serviceToStaffMap = useMemo(() => {
        if (!serviceStaff || serviceStaff.length === 0) return null;
        const map = new Map<string, Set<string>>();
        for (const row of serviceStaff) {
            if (!row.is_active) continue;
            if (!map.has(row.service_id)) map.set(row.service_id, new Set());
            map.get(row.service_id)?.add(row.staff_id);
        }
        return map;
    }, [serviceStaff]);

    const businessTz = getBusinessTimezone(biz.tz);

    const { temporaryTransfers } = useTemporaryTransfers({
        branchId,
        bizId: biz.id,
        staff,
    });

    const staffForSchedule = useMemo(
        () => staff.map((person) => ({ id: person.id, branch_id: person.branch_id })),
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

    const { data: clientBookingsCount = null, isLoading: clientBookingsLoading } = useClientBookings(
        biz.id,
        dayStr || null,
        isAuthed,
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
        businessTz,
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

    const guestBooking = useGuestBooking({
        bizId: biz.id,
        services: servicesForBooking,
        staffId,
        branchId,
        t,
        feedback: toast,
        onBookingCreated: () => {
            refreshSlots();
        },
    });

    const [authChoiceModalOpen, setAuthChoiceModalOpen] = useState(false);
    const [selectedSlotTime, setSelectedSlotTime] = useState<Date | null>(null);
    const [selectedSlotStaffId, setSelectedSlotStaffId] = useState<string | null>(null);
    const [pendingBooking, setPendingBooking] = useState<{ slotTime: Date; staffId: string } | null>(null);

    const { createBooking, loading: bookingLoading } = useBookingCreation({
        bizId: biz.id,
        branchId,
        services: servicesForBooking,
        staffId,
        isAuthed,
        t,
        feedback: toast,
        onAuthChoiceRequest: (slotTime, slotStaffId) => {
            setSelectedSlotTime(slotTime);
            setSelectedSlotStaffId(slotStaffId || null);
            if (slotStaffId && staffId === 'any') {
                setStaffId(slotStaffId);
            }
            setAuthChoiceModalOpen(true);
        },
        onStaffIdChange: (newStaffId) => {
            setStaffId(newStaffId);
        },
        onBookingCreated: () => {
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
        } catch (error) {
            logError('Booking', 'save booking state failed', error);
        }
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/auth/sign-in?mode=phone&redirect=${redirect}`;
    }

    const stepFromUrl = searchParams.get('step');
    const initialStep = useMemo(() => {
        const parsed = stepFromUrl ? parseInt(stepFromUrl, 10) : NaN;
        return Number.isFinite(parsed) ? Math.min(5, Math.max(1, parsed)) : 1;
    }, [stepFromUrl]);

    const { step, stepsMeta, canGoNext, canGoPrev, goNext, goPrev, goToStep, totalSteps } = useBookingSteps({
        branchId,
        dayStr,
        staffId,
        serviceIds,
        servicesFiltered,
        t,
        initialStep,
    });

    useEffect(() => {
        const next = new URLSearchParams();
        next.set('step', String(step));
        if (branchId) next.set('branch', branchId);
        if (dayStr) next.set('day', dayStr);
        if (staffId) next.set('staff', staffId);
        if (serviceIds.length > 0) {
            serviceIds.forEach((id) => next.append('service', id));
        }
        const query = next.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, [step, branchId, dayStr, staffId, serviceIds, pathname, router]);

    const stepIndicatorText = useMemo(
        () =>
            (t('booking.step.indicator', 'Шаг {current} из {total}') as string)
                .replace('{current}', String(step))
                .replace('{total}', String(totalSteps)),
        [t, step, totalSteps],
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
            staff_id: slotStaffId || (staffId === 'any' ? null : staffId || null),
            slot_start_at: slotTime.toISOString(),
            session_id: getSessionId(),
        });
        if (isAuthed) {
            setPendingBooking({ slotTime, staffId: slotStaffId });
        } else {
            void createBooking(slotTime, slotStaffId);
        }
    };

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(244,114,182,0.07),transparent_24%),linear-gradient(180deg,var(--surface-canvas),color-mix(in_srgb,var(--surface-muted)_72%,var(--surface-canvas)))]">
            <div className="mx-auto max-w-[var(--container-xl)] space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                <BookingHeader biz={biz} contacts={publicContacts} branchName={selectedBranch?.name} t={t} />

                <Card variant="elevated" padding="lg">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                        <div>
                            <p className="type-label text-[var(--accent-primary)]">
                                {t('booking.flow.badge', 'Пошаговая запись')}
                            </p>
                            <h2 className="type-section-title mt-2 text-[var(--text-primary)]">
                                {t('booking.flow.title', 'Понятный путь от выбора до подтверждения')}
                            </h2>
                            <p className="type-body mt-2 text-[var(--text-secondary)]">
                                {t(
                                    'booking.flow.description',
                                    'Поток разбит на короткие шаги: сначала контекст, потом специалист и услуги, а точное время выбирается только в самом конце.',
                                )}
                            </p>
                        </div>
                        <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4">
                            <div className="type-label text-[var(--text-primary)]">
                                {t('booking.flow.sideTitle', 'Что делает поток удобнее')}
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                                <li>• {t('booking.flow.side1', 'Шаги открываются последовательно и не дают потеряться.')}</li>
                                <li>• {t('booking.flow.side2', 'Сводка справа всегда показывает текущий выбор.')}</li>
                                <li>• {t('booking.flow.side3', 'После выбора времени поток перейдёт к подтверждению записи.')}</li>
                            </ul>
                        </div>
                    </div>
                </Card>

                {!isAuthed ? (
                    <AlertBanner
                        variant="warning"
                        title={t('booking.needAuthTitle', 'Для финального подтверждения понадобится вход или гостевая запись')}
                        message={t(
                            'booking.needAuth',
                            'Для бронирования необходимо войти или продолжить как гость после выбора слота.',
                        )}
                    />
                ) : null}

                {branchId && branchPromotions.length > 0 ? (
                    <PromotionsList promotions={branchPromotions} t={t} />
                ) : null}

                <BookingSteps
                    stepsMeta={stepsMeta}
                    step={step}
                    totalSteps={totalSteps}
                    canGoNext={canGoNext}
                    goToStep={goToStep}
                    stepIndicatorText={stepIndicatorText}
                />

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
                    onRetrySlots={refreshSlots}
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
                slotTimeLabel={selectedSlotTime ? toLabel(selectedSlotTime) : null}
            />

            <BookingConfirmModal
                open={pendingBooking !== null}
                busy={bookingLoading}
                onClose={() => setPendingBooking(null)}
                onConfirm={() => {
                    if (pendingBooking && !bookingLoading) {
                        void createBooking(pendingBooking.slotTime, pendingBooking.staffId);
                    }
                }}
                dayLabel={dayLabel}
                timeLabel={pendingBooking ? toLabel(pendingBooking.slotTime, businessTz) : ''}
                branchName={selectedBranch?.name ?? ''}
                staffName={staff.find((member) => member.id === pendingBooking?.staffId)?.full_name ?? ''}
                serviceNames={servicesForBooking.map((service) =>
                    locale === 'ky' ? service.name_ky || service.name_ru : locale === 'en' ? service.name_en || service.name_ru : service.name_ru,
                )}
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
                slotTimeLabel={guestBooking.slotTime ? toLabel(guestBooking.slotTime) : null}
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </main>
    );
}
