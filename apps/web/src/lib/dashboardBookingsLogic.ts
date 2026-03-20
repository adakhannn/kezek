import type { FilterPreset } from '@/app/dashboard/bookings/components/FilterPresets';
import {
    computeBookingPresetFilters,
    matchesBookingSearchQuery,
    matchesBookingStatusFilter,
    type BookingListItem,
    type BookingPresetFilters,
    type BookingStatus,
    type BookingStatusFilter,
} from '@core-domain/booking';

export type StatusFilter = BookingStatusFilter;
export type { BookingListItem, BookingStatus };
export type PresetFilters = BookingPresetFilters;

/**
 * Применяет статусный фильтр к статусу бронирования.
 * Выделено в чистую функцию для тестирования.
 */
export function matchesStatusFilter(status: BookingStatus, statusFilter: StatusFilter | 'holdConfirmed' | 'all'): boolean {
    return matchesBookingStatusFilter(status, statusFilter);
}

/**
 * Применяет текстовый поиск по услуге, мастеру, имени клиента, телефону и id.
 */
export function matchesSearchQuery(booking: BookingListItem, query: string): boolean {
    return matchesBookingSearchQuery(booking, query);
}

/**
 * Применяет пресет фильтров так же, как applyPreset в компоненте,
 * но без зависимостей от React — удобно тестировать.
 */
export function computePresetFilters(
    preset: FilterPreset,
    timezone: string,
    currentStaffId?: string | null,
): PresetFilters {
    return computeBookingPresetFilters(preset, timezone, currentStaffId);
}

