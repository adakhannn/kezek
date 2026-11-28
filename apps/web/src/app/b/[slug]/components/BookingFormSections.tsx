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
    /** The existing-bookings check failed: a notice with a retry, not silence (FE-08). */
    clientBookingsFailed?: boolean;
    onRetryClientBookings?: () => void;
    createBooking: (slotTime: Date, slotStaffId?: string) => void;
    day: Date;
    dayLabel: string;
    dayStr: string;
    dayInRange?: boolean;
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
    servicesLoading?: boolean;
    /** The service-staff map failed: the service step shows an error with a retry, not "no services". */
    servicesFailed?: boolean;
    onRetryServices?: () => void;
    selectedServicesForStep4: Service[];
    slots: Slot[];
    slotsError: string | null;
    slotsLoading: boolean;
    slotsHasMore?: boolean;
    slotsLoadingMore?: boolean;
    slotsMoreError?: string | null;
    onLoadMoreSlots?: () => void;
    staff: Staff[];
    staffCurrent: Staff | null;
    staffFiltered: Staff[];
    staffLoading?: boolean;
    staffError?: boolean;
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
    clientBookingsFailed,
    onRetryClientBookings,
    createBooking: _createBooking,
    day,
    dayLabel,
    dayStr,
    dayInRange = true,
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
    servicesLoading,
    servicesFailed,
    onRetryServices,
    selectedServicesForStep4,
    slots,
    slotsError,
    slotsLoading,
    slotsHasMore,
    slotsLoadingMore,
    slotsMoreError,
    onLoadMoreSlots,
    staff,
    staffCurrent,
    staffFiltered,
    staffLoading,
    staffError,
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
    const noStaffForRestoredServiceDay = step === 4 && !canGoNext && !!branchId && !!dayStr
        && !staffLoading && !staffError && staffFiltered.length === 0;

    // The time step is where a guest learns that sign-in (or guest details) comes next;
    // a signed-in client already gets the slot hint from SlotPicker.
    const step5Caption = isAuthed
        ? null
        : t('booking.flow.step5Description', 'После выбора времени войдите в аккаунт или продолжите как гость.');

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
            <div className="space-y-4">
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
                            <h2 className="type-section-title text-[var(--text-primary)]">
                                {t('booking.step2.title', 'Выберите день')}
                            </h2>
                        </div>
                        <div className="space-y-4">
                            <BookingDateCalendar
                                value={day}
                                min={todayTz(businessTz)}
                                max={addDays(todayTz(businessTz), 60)}
                                timezone={businessTz}
                                onChange={onDayChange}
                            />
                            {dayStr ? (
                                <AlertBanner
                                    variant={dayInRange ? 'info' : 'warning'}
                                    compact
                                    title={dayInRange
                                        ? t('booking.step2.selectedDate', 'Выбранная дата')
                                        : t('datePicker.chooseDate', 'Выберите удобный день')}
                                    message={dayInRange ? dayLabel : t('booking.step2.outOfRange', 'Выберите доступный день в календаре. Дата из ссылки или сохранённого выбора уже недоступна.')}
                                />
                            ) : null}
                        </div>
                    </Card>
                ) : null}

                {step === 3 ? (
                    <Card variant="elevated" padding="lg">
                        <div className="mb-5">
                            <h2 className="type-section-title text-[var(--text-primary)]">
                                {t('booking.step3.title', 'Выберите мастера')}
                            </h2>
                        </div>
                        <StaffSelector
                            staff={staffFiltered}
                            loading={staffLoading}
                            error={staffError}
                            selectedStaffId={staffId}
                            onSelect={onStaffSelect}
                            dayStr={dayStr}
                        />
                    </Card>
                ) : null}

                {step === 4 ? (
                    <Card variant="elevated" padding="lg">
                        <div className="mb-5">
                            <h2 className="type-section-title text-[var(--text-primary)]">
                                {t('booking.step4.title', 'Выберите услуги')}
                            </h2>
                        </div>
                        <ServiceSelector
                            services={servicesFiltered}
                            selectedServiceIds={serviceIds}
                            onToggle={onServiceToggle}
                            staffId={staffId}
                            loading={servicesLoading}
                            error={servicesFailed}
                            onRetry={onRetryServices}
                        />
                        {selectedServicesForStep4.length > 0 ? (
                            <div className="mt-4">
                                <AlertBanner
                                    variant="success"
                                    compact
                                    title={t('booking.step4.selectedSummary', 'Визит собран')}
                                    message={t('booking.duration.minutesValue', '{minutes} мин').replace('{minutes}', String(totalDurationStep4)) + (
                                        totalPriceFromStep4 > 0 || totalPriceToStep4 > 0
                                            ? ' · ' + t('booking.price.value', '{price} сом').replace(
                                                '{price}',
                                                `${totalPriceFromStep4}${totalPriceToStep4 !== totalPriceFromStep4 && totalPriceToStep4 > 0 ? `–${totalPriceToStep4}` : ''}`,
                                            )
                                            : ''
                                    )}
                                />
                            </div>
                        ) : null}
                    </Card>
                ) : null}

                {step === 5 ? (
                    <Card variant="elevated" padding="lg">
                        <div className="mb-5">
                            <h2 className="type-section-title text-[var(--text-primary)]">
                                {t('booking.step5.title', 'Выберите время')}
                            </h2>
                            {step5Caption ? (
                                <p className="type-caption mt-2 text-[var(--text-secondary)]">{step5Caption}</p>
                            ) : null}
                        </div>
                        <SlotPicker
                            slots={slots}
                            selectedSlot={null}
                            onSelect={onSlotSelect}
                            loading={slotsLoading}
                            hasMore={slotsHasMore}
                            loadingMore={slotsLoadingMore}
                            moreError={slotsMoreError}
                            onLoadMore={onLoadMoreSlots}
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
                            clientBookingsFailed={clientBookingsFailed}
                            onRetryClientBookings={onRetryClientBookings}
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
                                    : noStaffForRestoredServiceDay
                                        ? t('booking.empty.noStaffTitle', 'На эту дату нет доступных специалистов')
                                    : t('booking.nav.pending', 'Нужен ещё один выбор')}
                            </div>
                            <p className="type-caption mt-1 text-[var(--text-secondary)]">
                                {canGoNext
                                    ? t('booking.nav.readyHint', 'Можно безопасно переходить к следующему шагу.')
                                    : noStaffForRestoredServiceDay
                                        ? t('booking.empty.noStaff', 'На выбранную дату в этом филиале нет доступных мастеров. Выберите другой день.')
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
                staffId={staffId}
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
