'use client';

import { addDays } from 'date-fns';

import { BookingDateCalendar } from '../components/BookingDateCalendar';
import { BookingSummary } from '../components/BookingSummary';
import { BranchSelector } from '../components/BranchSelector';
import { ServiceSelector } from '../components/ServiceSelector';
import { SlotPicker } from '../components/SlotPicker';
import { StaffSelector } from '../components/StaffSelector';
import type { Branch, Promotion, Service, ServiceStaffRow, Slot, Staff } from '../types';

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
};

export function BookingFormSections({
    bizId,
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
}: BookingFormSectionsProps) {
    const branch = branches.find((item) => item.id === branchId) ?? null;

    return (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            <div className="space-y-4">
                {step === 1 && (
                    <BranchSelector
                        branches={branches}
                        selectedBranchId={branchId}
                        onSelect={onBranchSelect}
                        formatBranchName={formatBranchName}
                        t={t}
                    />
                )}

                {step === 2 && (
                    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {t('booking.step2.title', 'Шаг 2. Выберите день')}
                        </h2>
                        <div className="space-y-3">
                            <BookingDateCalendar
                                value={day}
                                min={todayTz(businessTz)}
                                max={addDays(todayTz(businessTz), 60)}
                                onChange={onDayChange}
                            />
                            {dayStr && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {t('booking.step2.selectedDate', 'Выбранная дата:')} {dayLabel}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {step === 3 && (
                    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {t('booking.step3.title', 'Шаг 3. Выберите мастера')}
                        </h2>
                        <StaffSelector
                            staff={staffFiltered}
                            selectedStaffId={staffId}
                            onSelect={onStaffSelect}
                            dayStr={dayStr}
                        />
                    </section>
                )}

                {step === 4 && (
                    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {t('booking.step4.title', 'Шаг 4. Выберите услугу')}
                        </h2>
                        <ServiceSelector
                            services={servicesFiltered}
                            selectedServiceIds={serviceIds}
                            onToggle={onServiceToggle}
                            staffId={staffId}
                        />
                        {selectedServicesForStep4.length > 0 && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                {t('booking.duration.label', 'Продолжительность:')}{' '}
                                {totalDurationStep4} {t('booking.duration.min', 'мин')}.
                                {(totalPriceFromStep4 > 0 || totalPriceToStep4 > 0) && (
                                    <>
                                        {' '}
                                        {t('booking.summary.estimatedPrice', 'Ориентировочная стоимость:')}{' '}
                                        {totalPriceFromStep4}
                                        {totalPriceToStep4 !== totalPriceFromStep4 && totalPriceToStep4 > 0
                                            ? `–${totalPriceToStep4}`
                                            : ''}{' '}
                                        {t('booking.currency', 'сом')}.
                                    </>
                                )}
                            </p>
                        )}
                    </section>
                )}

                {step === 5 && (
                    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {t('booking.step5.title', 'Шаг 5. Выберите время')}
                        </h2>
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
                        />
                    </section>
                )}

                <div className="flex justify-between pt-1 text-xs">
                    <button
                        type="button"
                        disabled={!canGoPrev}
                        onClick={goPrev}
                        className={`inline-flex min-h-[44px] touch-manipulation items-center gap-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition sm:min-h-[32px] sm:px-3 sm:py-1.5 sm:text-xs ${
                            canGoPrev
                                ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'
                                : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600'
                        }`}
                    >
                        {t('booking.nav.back', '← Назад')}
                    </button>
                    <button
                        type="button"
                        disabled={!canGoNext}
                        onClick={goNext}
                        className={`inline-flex min-h-[44px] touch-manipulation items-center gap-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition sm:min-h-[32px] sm:px-3 sm:py-1.5 sm:text-xs ${
                            canGoNext
                                ? 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 dark:border-indigo-400'
                                : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600'
                        }`}
                    >
                        {step === totalSteps
                            ? t('booking.nav.selectTime', 'Выбрать время')
                            : t('booking.nav.next', 'Далее →')}
                    </button>
                </div>
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
            />
        </div>
    );
}
