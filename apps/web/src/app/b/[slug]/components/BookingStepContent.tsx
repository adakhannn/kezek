'use client';

import DatePickerPopover from '@/components/pickers/DatePickerPopover';

import { BranchSelector } from './BranchSelector';
import { ServiceSelector } from './ServiceSelector';
import { SlotPicker } from './SlotPicker';
import { StaffSelector } from './StaffSelector';
import type { BookingStep, Branch, Service, ServiceStaffRow, Slot, Staff } from '../types';

type BookingStepContentProps = {
    step: BookingStep;
    branches: Branch[];
    branchId: string;
    dayStr: string;
    dayLabel: string;
    todayStr: string;
    maxStr: string;
    staffFiltered: Staff[];
    staffId: string;
    servicesFiltered: Service[];
    serviceId: string;
    serviceCurrent: Service | null;
    slots: Slot[];
    slotsLoading: boolean;
    slotsError: string | null;
    staff: Staff[];
    serviceStaff: ServiceStaffRow[] | null;
    isAuthed: boolean;
    clientBookingsCount: number | null;
    clientBookingsLoading: boolean;
    bookingLoading: boolean;
    t: (key: string, fallback?: string) => string;
    formatBranchName: (name: string) => string;
    onBranchSelect: (branchId: string) => void;
    onDaySelect: (dayValue: string) => void;
    onStaffSelect: (staffId: string) => void;
    onServiceSelect: (serviceId: string) => void;
    onSlotSelect: (slotTime: Date, slotStaffId: string) => void;
};

export function BookingStepContent({
    step,
    branches,
    branchId,
    dayStr,
    dayLabel,
    todayStr,
    maxStr,
    staffFiltered,
    staffId,
    servicesFiltered,
    serviceId,
    serviceCurrent,
    slots,
    slotsLoading,
    slotsError,
    staff,
    serviceStaff,
    isAuthed,
    clientBookingsCount,
    clientBookingsLoading,
    bookingLoading,
    t,
    formatBranchName,
    onBranchSelect,
    onDaySelect,
    onStaffSelect,
    onServiceSelect,
    onSlotSelect,
}: BookingStepContentProps) {
    if (step === 1) {
        return (
            <BranchSelector
                branches={branches}
                selectedBranchId={branchId}
                onSelect={onBranchSelect}
                formatBranchName={formatBranchName}
                t={t}
            />
        );
    }

    if (step === 2) {
        return (
            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {t('booking.step2.title', 'Шаг 2. Выберите день')}
                </h2>
                <div className="space-y-3">
                    <DatePickerPopover
                        value={dayStr}
                        onChange={(value) => {
                            if (value) onDaySelect(value);
                        }}
                        min={todayStr}
                        max={maxStr}
                    />
                    {dayStr && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                            {t('booking.step2.selectedDate', 'Выбранная дата:')} {dayLabel}
                        </div>
                    )}
                </div>
            </section>
        );
    }

    if (step === 3) {
        return (
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
        );
    }

    if (step === 4) {
        return (
            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {t('booking.step4.title', 'Шаг 4. Выберите услугу')}
                </h2>
                <ServiceSelector
                    services={servicesFiltered}
                    selectedServiceId={serviceId}
                    onSelect={onServiceSelect}
                    staffId={staffId}
                />
                {serviceCurrent && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {t('booking.duration.label', 'Продолжительность:')} {serviceCurrent.duration_min} {t('booking.duration.min', 'мин')}.
                        {serviceCurrent.price_from && (
                            <>
                                {' '}
                                {t('booking.summary.estimatedPrice', 'Ориентировочная стоимость:')}{' '}
                                {serviceCurrent.price_from}
                                {serviceCurrent.price_to && serviceCurrent.price_to !== serviceCurrent.price_from
                                    ? `–${serviceCurrent.price_to}`
                                    : ''}{' '}
                                {t('booking.currency', 'сом')}.
                            </>
                        )}
                    </p>
                )}
            </section>
        );
    }

    return (
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
                isAuthed={isAuthed}
                clientBookingsCount={clientBookingsCount}
                clientBookingsLoading={clientBookingsLoading}
                bookingLoading={bookingLoading}
            />
        </section>
    );
}
