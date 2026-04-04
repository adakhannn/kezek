'use client';

import { BookingEmptyState } from '../BookingEmptyState';
import type { Slot, Staff } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { formatStaffName } from '@/lib/i18nHelpers';
import { toLabel } from '@/lib/time';

function formatVisitDuration(totalMin: number, t: (key: string, fallback?: string) => string): string {
    if (totalMin <= 0) return '';
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hours > 0 && mins > 0) {
        return `${hours} ${t('booking.duration.hour', 'ч')} ${mins} ${t('booking.duration.min', 'мин')}`;
    }
    if (hours > 0) {
        return `${hours} ${t('booking.duration.hour', 'ч')}`;
    }
    return `${mins} ${t('booking.duration.min', 'мин')}`;
}

type SlotPickerProps = {
    slots: Slot[];
    selectedSlot: Date | null;
    onSelect: (date: Date, staffId: string) => void;
    loading: boolean;
    error: string | null;
    dayStr: string | null;
    dayLabel: string;
    staffId: string | null;
    staff: Staff[];
    serviceId: string | null;
    servicesFiltered: Array<{ id: string }>;
    serviceStaff: Array<{ service_id: string; staff_id: string; is_active: boolean }> | null;
    totalDurationMin?: number;
    isAuthed: boolean;
    clientBookingsCount: number | null;
    clientBookingsLoading: boolean;
    bookingLoading: boolean;
    onRetry?: () => void;
};

export function SlotPicker({
    slots,
    selectedSlot,
    onSelect,
    loading,
    error,
    dayStr,
    dayLabel,
    staffId,
    staff,
    serviceId,
    servicesFiltered,
    serviceStaff,
    totalDurationMin,
    isAuthed,
    clientBookingsCount,
    clientBookingsLoading,
    bookingLoading,
    onRetry,
}: SlotPickerProps) {
    const { t, locale } = useLanguage();
    const formatName = (name: string) => formatStaffName(name, locale);

    const isServiceValid = serviceId && servicesFiltered.some((service) => service.id === serviceId);
    const showServiceError =
        serviceId && staffId && !loading && slots.length === 0 && serviceStaff !== null && !isServiceValid && !error;

    return (
        <div className="space-y-4">
            {dayStr ? (
                <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-4 py-3">
                    <div className="type-label text-[var(--text-primary)]">
                        {t('booking.step5.selectedDate', 'Выбранная дата')}: {dayLabel}
                    </div>
                    <div className="type-caption mt-1 text-[var(--text-secondary)]">
                        {t('booking.step5.description', 'Остаётся выбрать удобное время. После этого поток продолжит подтверждение записи.')}
                    </div>
                </div>
            ) : null}

            {showServiceError ? (
                <BookingEmptyState
                    type="warning"
                    title={t('booking.step5.masterNoService', 'Выбранный мастер не выполняет эту услугу')}
                    message={t('booking.step5.masterNoServiceHint', 'Вернитесь к предыдущему шагу и выберите другого мастера или другую услугу.')}
                />
            ) : null}

            {isAuthed && !clientBookingsLoading && clientBookingsCount && clientBookingsCount > 0 ? (
                <AlertBanner
                    variant="warning"
                    title={t('booking.existingBookings.title', 'У вас уже есть запись на этот день')}
                    message={
                        clientBookingsCount === 1
                            ? t('booking.existingBookings.warning.one', 'У вас уже есть одна активная запись в этом заведении на выбранный день.')
                            : t('booking.existingBookings.warning.many', `У вас уже есть ${clientBookingsCount} активных записей в этом заведении на выбранный день.`)
                    }
                />
            ) : null}

            <div>
                <h3 className="type-label text-[var(--text-primary)]">
                    {t('booking.freeSlots', 'Свободные слоты')}
                </h3>
                <p className="type-caption mt-1 text-[var(--text-secondary)]">
                    {t('booking.step5.slotHint', 'Клик по времени сразу продолжит запись с выбранным слотом.')}
                </p>
            </div>

            {loading ? (
                <BookingEmptyState
                    type="loading"
                    title={t('booking.loadingSlots', 'Загружаем свободные слоты')}
                    message={t('booking.loadingSlots', 'Загружаем свободные слоты')}
                    hint={t('booking.loadingSlotsHint', 'Проверяем доступность выбранного дня, специалиста и услуг.')}
                />
            ) : null}

            {!loading && error ? (
                <BookingEmptyState
                    type="error"
                    title={t('booking.error.slotsTitle', 'Не удалось получить свободные слоты')}
                    message={error}
                    action={
                        onRetry ? (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-sm)] border border-current px-3 py-1.5 text-xs font-medium transition-all hover:bg-white/20"
                            >
                                {t('booking.retry', 'Повторить')}
                            </button>
                        ) : undefined
                    }
                />
            ) : null}

            {!loading && !error && slots.length === 0 ? (
                <BookingEmptyState
                    type="empty"
                    title={t('booking.empty.noSlotsTitle', 'Свободных слотов пока нет')}
                    message={t('booking.empty.noSlots', 'На выбранный день нет свободных слотов. Выберите другой день или мастера.')}
                    action={
                        onRetry ? (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-all hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                            >
                                {t('booking.retry', 'Обновить')}
                            </button>
                        ) : undefined
                    }
                />
            ) : null}

            {!loading && !error && slots.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {slots.map((slot) => {
                        const date = new Date(slot.start_at);
                        const slotStaff = staff.find((person) => person.id === slot.staff_id);
                        const showStaffName = staffId === 'any' && slotStaff;
                        const isSelected = selectedSlot ? selectedSlot.getTime() === date.getTime() : false;

                        return (
                            <button
                                key={`${slot.start_at}-${slot.staff_id}`}
                                type="button"
                                disabled={bookingLoading}
                                data-testid="time-slot"
                                onClick={() => onSelect(date, slot.staff_id)}
                                className={[
                                    'rounded-[22px] border px-4 py-4 text-left transition-all',
                                    isSelected
                                        ? 'border-[var(--accent-primary)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)] shadow-[var(--shadow-sm)]'
                                        : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--accent-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)]',
                                    bookingLoading ? 'cursor-not-allowed opacity-60' : '',
                                ].join(' ')}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="type-section-title text-[var(--text-primary)]">{toLabel(date)}</div>
                                        {totalDurationMin != null && totalDurationMin > 0 ? (
                                            <div className="type-caption mt-1 text-[var(--text-secondary)]">
                                                {formatVisitDuration(totalDurationMin, t)}
                                            </div>
                                        ) : null}
                                        {showStaffName && slotStaff ? (
                                            <div className="type-caption mt-1 text-[var(--text-secondary)]">
                                                {formatName(slotStaff.full_name)}
                                            </div>
                                        ) : null}
                                    </div>
                                    <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                                        {bookingLoading ? t('booking.loading', 'Подождите') : t('booking.step5.choose', 'Выбрать')}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
