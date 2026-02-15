/**
 * Компонент для выбора временного слота
 * Вынесен из view.tsx для улучшения поддерживаемости
 */

'use client';

import { BookingEmptyState } from '../BookingEmptyState';
import type { Slot, Staff } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { toLabel } from '@/lib/time';


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
    isAuthed: boolean;
    clientBookingsCount: number | null;
    clientBookingsLoading: boolean;
    bookingLoading: boolean;
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
    isAuthed,
    clientBookingsCount,
    clientBookingsLoading,
    bookingLoading,
}: SlotPickerProps) {
    const { t } = useLanguage();

    const formatStaffName = (name: string): string => {
        // Транслитерируем имя мастера для английского языка
        // Для простоты используем базовую транслитерацию
        return name;
    };

    // Проверка: есть ли у выбранного сотрудника услуги для выбранной услуги
    const isServiceValid = serviceId && servicesFiltered.some((s) => s.id === serviceId);
    const showServiceError = serviceId && staffId && !loading && slots.length === 0 && 
        serviceStaff !== null && !isServiceValid && !error;

    return (
        <>
            {dayStr && (
                <div className="mb-3 text-xs text-gray-600 dark:text-gray-400">
                    {t('booking.step5.selectedDate', 'Выбранная дата:')} {dayLabel}
                </div>
            )}

            {/* Ошибка: мастер не выполняет услугу */}
            {showServiceError && (
                <div className="mb-3">
                    <BookingEmptyState
                        type="warning"
                        message={t('booking.step5.masterNoService', 'Выбранный мастер не выполняет эту услугу')}
                        hint={t('booking.step5.masterNoServiceHint', 'Пожалуйста, вернитесь к шагу 4 и выберите другого мастера или выберите другую услугу.')}
                    />
                </div>
            )}

            {/* Уведомление, если у клиента уже есть запись в этом бизнесе на выбранный день */}
            {isAuthed && !clientBookingsLoading && clientBookingsCount && clientBookingsCount > 0 && (
                <div className="mb-3">
                    <BookingEmptyState
                        type="warning"
                        message={
                            clientBookingsCount === 1
                                ? t('booking.existingBookings.warning.one', 'У вас уже есть одна активная запись в этом заведении на выбранный день.')
                                : t('booking.existingBookings.warning.many', `У вас уже есть ${clientBookingsCount} активных записей в этом заведении на выбранный день.`)
                        }
                        hint={t('booking.existingBookings.hint', 'Вы всё равно можете оформить ещё одну запись, если это необходимо.')}
                    />
                </div>
            )}

            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('booking.freeSlots', 'Свободные слоты')}
            </h3>

            {loading && (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                    {t('booking.loadingSlots', 'Загружаем свободные слоты...')}
                </div>
            )}

            {!loading && error && (
                <BookingEmptyState
                    type="error"
                    message={error}
                />
            )}

            {!loading && !error && slots.length === 0 && (
                <BookingEmptyState
                    type="empty"
                    message={t('booking.empty.noSlots', 'На выбранный день нет свободных слотов. Выберите другой день или мастера.')}
                />
            )}

            {!loading && !error && slots.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                    {slots.map((s) => {
                        const d = new Date(s.start_at);
                        const slotStaff = staff.find((m) => m.id === s.staff_id);
                        const showStaffName = staffId === 'any' && slotStaff;
                        return (
                            <button
                                key={`${s.start_at}-${s.staff_id}`}
                                disabled={bookingLoading}
                                data-testid="time-slot"
                                className="rounded-full border border-gray-300 bg-white px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm sm:text-xs font-medium text-gray-800 shadow-sm transition hover:border-indigo-500 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40 min-h-[44px] sm:min-h-[32px] touch-manipulation"
                                onClick={() => onSelect(d, s.staff_id)}
                            >
                                <div className="flex flex-col items-center">
                                    <span>{toLabel(d)}</span>
                                    {showStaffName && slotStaff && (
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                            {formatStaffName(slotStaff.full_name)}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </>
    );
}

