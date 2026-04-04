'use client';

import { addDays } from 'date-fns';

import { BookingDateCalendar } from '../components/BookingDateCalendar';
import { BookingSummary } from '../components/BookingSummary';
import { BranchSelector } from '../components/BranchSelector';
import { ServiceSelector } from '../components/ServiceSelector';
import { SlotPicker } from '../components/SlotPicker';
import { StaffSelector } from '../components/StaffSelector';
import type { Branch, Promotion, Service, ServiceStaffRow, Slot, Staff } from '../types';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { todayTz } from '@/lib/time';

type TranslateFn = (key: string, fallback?: string) => string;

type BookingFormSectionsProps = {
    bizId: string;
    branchId: string;
    branches: Branch[];
    branchPromotions: Promotion[];
    businessTz: string;
    canGoNext: boolean;
    canGoPrev: boolean;
    clientBookingsCount: number | null;
    clientBookingsLoading: boolean;
    createBooking: (slotTime: Date, slotStaffId?: string) => void;
    day: Date;
    dayLabel: string;
    dayStr: string;
    formatBranchName: (name: string) => string;
    goNext: () => void;
    goPrev: () => void;
    isAuthed: boolean;
    bookingLoading: boolean;
    serviceCurrent: Service | null;
    serviceId: string;
    serviceIds: string[];
    serviceStaff: ServiceStaffRow[] | null;
    servicesFiltered: Service[];
    selectedServicesForStep4: Service[];
    slots: Slot[];
    slotsError: string | null;
    slotsLoading: boolean;
    staff: Staff[];
    staffCurrent: Staff | null;
    staffFiltered: Staff[];
    staffId: string;
    step: number;
    t: TranslateFn;
    totalDurationStep4: number;
    totalPriceFromStep4: number;
    totalPriceToStep4: number;
    totalSteps: number;
    onBranchSelect: (id: string) => void;
    onDayChange: (nextDay: Date) => void;
    onServiceToggle: (id: string) => void;
    onSlotSelect: (slotTime: Date, slotStaffId: string) => void;
    onStaffSelect: (id: string) => void;
    onRetrySlots: () => void;
};

export function BookingFormSections({
    bizId: _bizId,
    branchId,
    branches,
    branchPromotions,
    businessTz,
    canGoNext,
    canGoPrev,
    clientBookingsCount,
    clientBookingsLoading,
    createBooking: _createBooking,
    day,
    dayLabel,
    dayStr,
    formatBranchName,
    goNext,
    goPrev,
    isAuthed,
    bookingLoading,
    serviceCurrent,
    serviceId,
    serviceIds,
    serviceStaff,
    servicesFiltered,
    selectedServicesForStep4,
    slots,
    slotsError,
    slotsLoading,
    staff,
    staffCurrent,
    staffFiltered,
    staffId,
    step,
    t,
    totalDurationStep4,
    totalPriceFromStep4,
    totalPriceToStep4,
    totalSteps,
    onBranchSelect,
    onDayChange,
    onServiceToggle,
    onSlotSelect,
    onStaffSelect,
    onRetrySlots,
}: BookingFormSectionsProps) {
    const branch = branches.find((item) => item.id === branchId) ?? null;

    const stepMeta: Record<number, { title: string; description: string; next: string }> = {
        1: {
            title: t('booking.flow.step1Title', 'Сначала выберите филиал'),
            description: t('booking.flow.step1Description', 'После выбора локации система покажет только релевантные сценарии записи.'),
            next: t('booking.flow.step1Next', 'Дальше откроется выбор даты.'),
        },
        2: {
            title: t('booking.flow.step2Title', 'Теперь выберите день'),
            description: t('booking.flow.step2Description', 'Дата помогает отфильтровать реально доступных специалистов.'),
            next: t('booking.flow.step2Next', 'Дальше откроется выбор мастера.'),
        },
        3: {
            title: t('booking.flow.step3Title', 'Определитесь со специалистом'),
            description: t('booking.flow.step3Description', 'Можно выбрать конкретного мастера или доверить системе ближайший слот.'),
            next: t('booking.flow.step3Next', 'Дальше откроется выбор услуг.'),
        },
        4: {
            title: t('booking.flow.step4Title', 'Соберите визит из услуг'),
            description: t('booking.flow.step4Description', 'На этом шаге уже видно длительность и ориентир по стоимости.'),
            next: t('booking.flow.step4Next', 'Дальше останется выбрать точное время.'),
        },
        5: {
            title: t('booking.flow.step5Title', 'Выберите свободное время'),
            description: t('booking.flow.step5Description', 'Клик по слоту продолжит запись через авторизацию или гостевой сценарий.'),
            next: t('booking.flow.step5Next', 'После выбора слота поток перейдёт к подтверждению.'),
        },
    };

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
            <div className="space-y-4">
                <Card variant="elevated" padding="lg">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="type-label text-[var(--accent-primary)]">{stepMeta[step].title}</p>
                            <p className="type-body mt-2 text-[var(--text-secondary)]">{stepMeta[step].description}</p>
                        </div>
                        <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
                            {stepMeta[step].next}
                        </div>
                    </div>
                </Card>

                {step === 1 ? (
                    <BranchSelector
                        branches={branches}
                        selectedBranchId={branchId}
                        onSelect={onBranchSelect}
                        formatBranchName={formatBranchName}
                        t={t}
                    />
                ) : null}

                {step === 2 ? (
                    <Card variant="elevated" padding="lg">
                        <div className="mb-5">
                            <p className="type-label text-[var(--accent-primary)]">{t('booking.step2.kicker', 'Шаг 2')}</p>
                            <h2 className="type-section-title mt-2 text-[var(--text-primary)]">
                                {t('booking.step2.title', 'Выберите день')}
                            </h2>
                            <p className="type-caption mt-2 text-[var(--text-secondary)]">
                                {t('booking.step2.description', 'Календарь показывает ближайшие доступные даты для продолжения записи.')}
                            </p>
                        </div>
                        <div className="space-y-4">
                            <BookingDateCalendar
                                value={day}
                                min={todayTz(businessTz)}
                                max={addDays(todayTz(businessTz), 60)}
                                onChange={onDayChange}
                            />
                            {dayStr ? (
                                <AlertBanner
                                    variant="info"
                                    compact
                                    title={t('booking.step2.selectedDate', 'Выбранная дата')}
                                    message={dayLabel}
                                />
                            ) : null}
                        </div>
                    </Card>
                ) : null}

                {step === 3 ? (
                    <Card variant="elevated" padding="lg">
                        <div className="mb-5">
                            <p className="type-label text-[var(--accent-primary)]">{t('booking.step3.kicker', 'Шаг 3')}</p>
                            <h2 className="type-section-title mt-2 text-[var(--text-primary)]">
                                {t('booking.step3.title', 'Выберите мастера')}
                            </h2>
                        </div>
                        <StaffSelector
                            staff={staffFiltered}
                            selectedStaffId={staffId}
                            onSelect={onStaffSelect}
                            dayStr={dayStr}
                        />
                    </Card>
                ) : null}

                {step === 4 ? (
                    <Card variant="elevated" padding="lg">
                        <div className="mb-5">
                            <p className="type-label text-[var(--accent-primary)]">{t('booking.step4.kicker', 'Шаг 4')}</p>
                            <h2 className="type-section-title mt-2 text-[var(--text-primary)]">
                                {t('booking.step4.title', 'Выберите услуги')}
                            </h2>
                        </div>
                        <ServiceSelector
                            services={servicesFiltered}
                            selectedServiceIds={serviceIds}
                            onToggle={onServiceToggle}
                            staffId={staffId}
                        />
                        {selectedServicesForStep4.length > 0 ? (
                            <div className="mt-4">
                                <AlertBanner
                                    variant="success"
                                    compact
                                    title={t('booking.step4.selectedSummary', 'Визит собран')}
                                    message={`${totalDurationStep4} ${t('booking.duration.min', 'мин')}${
                                        totalPriceFromStep4 > 0 || totalPriceToStep4 > 0
                                            ? ` · ${totalPriceFromStep4}${totalPriceToStep4 !== totalPriceFromStep4 && totalPriceToStep4 > 0 ? `–${totalPriceToStep4}` : ''} ${t('booking.currency', 'сом')}`
                                            : ''
                                    }`}
                                />
                            </div>
                        ) : null}
                    </Card>
                ) : null}

                {step === 5 ? (
                    <Card variant="elevated" padding="lg">
                        <div className="mb-5">
                            <p className="type-label text-[var(--accent-primary)]">{t('booking.step5.kicker', 'Шаг 5')}</p>
                            <h2 className="type-section-title mt-2 text-[var(--text-primary)]">
                                {t('booking.step5.title', 'Выберите время')}
                            </h2>
                        </div>
                        <SlotPicker
                            slots={slots}
                            selectedSlot={null}
                            onSelect={onSlotSelect}
                            loading={slotsLoading}
                            error={slotsError}
                            dayStr={dayStr}
                            dayLabel={dayLabel}
                            staffId={staffId}
                            staff={staff}
                            serviceId={serviceId}
                            servicesFiltered={servicesFiltered}
                            serviceStaff={serviceStaff}
                            totalDurationMin={serviceIds.length > 1 ? totalDurationStep4 : undefined}
                            isAuthed={isAuthed}
                            clientBookingsCount={clientBookingsCount}
                            clientBookingsLoading={clientBookingsLoading}
                            bookingLoading={bookingLoading}
                            onRetry={onRetrySlots}
                        />
                    </Card>
                ) : null}

                <Card variant="elevated" padding="md">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="type-label text-[var(--text-primary)]">
                                {canGoNext
                                    ? t('booking.nav.ready', 'Текущий шаг готов')
                                    : t('booking.nav.pending', 'Нужен ещё один выбор')}
                            </div>
                            <p className="type-caption mt-1 text-[var(--text-secondary)]">
                                {canGoNext
                                    ? t('booking.nav.readyHint', 'Можно безопасно переходить к следующему шагу.')
                                    : t('booking.nav.pendingHint', 'Поток специально не даёт потеряться: сначала завершите текущий шаг.')}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                disabled={!canGoPrev}
                                onClick={goPrev}
                                size="sm"
                                variant="outline"
                                className="shadow-none"
                            >
                                {t('booking.nav.back', 'Назад')}
                            </Button>
                            <Button type="button" disabled={!canGoNext} onClick={goNext} size="sm">
                                {step === totalSteps
                                    ? t('booking.nav.selectTime', 'К выбору времени')
                                    : t('booking.nav.next', 'Далее')}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            <BookingSummary
                branchName={branch ? formatBranchName(branch.name) : null}
                dayLabel={dayLabel}
                staffCurrent={staffCurrent}
                serviceCurrent={serviceCurrent}
                servicesSelected={selectedServicesForStep4.length > 0 ? selectedServicesForStep4 : undefined}
                branchId={branchId}
                branchPromotions={branchPromotions}
                isAuthed={isAuthed}
                step={step}
            />
        </div>
    );
}
