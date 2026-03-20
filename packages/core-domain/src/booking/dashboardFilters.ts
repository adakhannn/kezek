import type { BookingStatus } from './types';

export type BookingStatusFilter =
    | 'all'
    | 'active'
    | 'hold'
    | 'confirmed'
    | 'paid'
    | 'cancelled'
    | 'no_show';

export type BookingListItem = {
    id: string;
    status: BookingStatus;
    start_at: string;
    branch_id?: string | null;
    services?:
        | { name_ru: string; name_ky?: string | null }[]
        | { name_ru: string; name_ky?: string | null }
        | null;
    staff?: { full_name: string }[] | { full_name: string } | null;
    client_name?: string | null;
    client_phone?: string | null;
};

export type BookingPresetFilters = {
    statusFilter?: BookingStatusFilter | 'holdConfirmed';
    branchFilter?: string;
    dateFilter?: { gte: string; lte: string };
    staffFilter?: string;
};

export type BookingFilterPreset = 'today' | 'myStaff' | 'holdConfirmed' | null;

/**
 * Domain semantics for booking status groups used in dashboards/client flows.
 */
export function matchesBookingStatusFilter(
    status: BookingStatus,
    statusFilter: BookingStatusFilter | 'holdConfirmed' | 'all',
): boolean {
    if (statusFilter === 'all') {
        return status !== 'cancelled';
    }
    if (statusFilter === 'active') {
        return status === 'confirmed';
    }
    if (statusFilter === 'holdConfirmed') {
        return status === 'hold' || status === 'confirmed';
    }
    return status === statusFilter;
}

/**
 * Domain-level booking search matching by the core client-visible fields.
 */
export function matchesBookingSearchQuery(
    booking: BookingListItem,
    query: string,
): boolean {
    const q = query.toLowerCase().trim();
    if (!q) return true;

    const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
    const master = Array.isArray(booking.staff) ? booking.staff[0] : booking.staff;

    return (
        (service?.name_ru?.toLowerCase().includes(q) ?? false) ||
        (master?.full_name?.toLowerCase().includes(q) ?? false) ||
        (booking.client_name?.toLowerCase().includes(q) ?? false) ||
        (booking.client_phone?.includes(q) ?? false) ||
        String(booking.id).toLowerCase().includes(q)
    );
}

/**
 * Domain mapping from common booking filter presets to effective filter values.
 * Timezone is reserved for future timezone-aware date boundaries.
 */
export function computeBookingPresetFilters(
    preset: BookingFilterPreset,
    _timezone: string,
    currentStaffId?: string | null,
): BookingPresetFilters {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const todayStart = `${todayStr}T00:00:00`;
    const todayEnd = `${todayStr}T23:59:59`;

    switch (preset) {
        case 'today':
            return {
                dateFilter: {
                    gte: todayStart,
                    lte: todayEnd,
                },
            };
        case 'myStaff':
            return currentStaffId
                ? {
                      staffFilter: currentStaffId,
                  }
                : {};
        case 'holdConfirmed':
            return {
                statusFilter: 'holdConfirmed',
            };
        default:
            return {};
    }
}
