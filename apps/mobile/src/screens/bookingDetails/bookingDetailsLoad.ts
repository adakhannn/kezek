import { apiRequest } from '../../lib/api';
import { getApiErrorStatus } from '../../lib/errors';
import { loadOfflineBookings, type OfflineBooking } from '../../lib/offlineBookingsStorage';
import type { BookingDetails } from './types';

type ApiEnvelope<T> = {
    ok?: boolean;
    data?: T;
};

/** The details and, when they come from the cabinet's offline copy, when it was saved. */
export type BookingDetailsResult = {
    booking: BookingDetails;
    offlineSavedAt: string | null;
};

/**
 * B4: a failure is no longer "not found". 404/403 mean the booking is gone or not the caller's;
 * a lost connection, a timeout or a server error is transient (retry, offline copy); any other
 * answer (401 …) is an error with a retry.
 */
export type BookingDetailsFailure = 'not_found' | 'transient' | 'error';

export function classifyBookingDetailsError(error: unknown): BookingDetailsFailure {
    const status = getApiErrorStatus(error);
    if (status === 404 || status === 403) return 'not_found';
    if (status === undefined || status >= 500 || status === 408 || status === 429) return 'transient';
    return 'error';
}

export class BookingDetailsLoadError extends Error {
    constructor(readonly kind: BookingDetailsFailure, readonly original: unknown) {
        super(original instanceof Error ? original.message : String(original));
        this.name = 'BookingDetailsLoadError';
    }
}

function unwrapBookingDetails(payload: BookingDetails | ApiEnvelope<BookingDetails>): BookingDetails {
    if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
        return payload.data;
    }

    return payload as BookingDetails;
}

/** The cabinet's offline copy has names only: no ids, prices or phones, so no actions from it. */
export function offlineBookingToDetails(item: OfflineBooking): BookingDetails {
    return {
        id: item.id,
        start_at: item.start_at,
        end_at: item.end_at,
        status: item.status,
        viewer_role: 'client',
        service: item.service_name
            ? {
                  name_ru: item.service_name,
                  name_ky: item.service_name_ky ?? null,
                  name_en: item.service_name_en ?? null,
                  duration_min: 0,
                  price_from: null,
                  price_to: null,
              }
            : null,
        staff: item.staff_name ? { full_name: item.staff_name } : null,
        branch: item.branch_name ? { name: item.branch_name, address: null } : null,
        business: item.business_name
            ? { name: item.business_name, phones: [], ...(item.business_tz ? { tz: item.business_tz } : {}) }
            : null,
    };
}

export async function loadBookingDetails({
    bookingId,
    userId,
}: {
    bookingId: string;
    /** The signed-in user whose offline copy may stand in; none means no fallback. */
    userId: string | null;
}): Promise<BookingDetailsResult> {
    try {
        const payload = await apiRequest<BookingDetails | ApiEnvelope<BookingDetails>>(`/mobile/bookings/${bookingId}`, {
            method: 'GET',
        });
        return { booking: unwrapBookingDetails(payload), offlineSavedAt: null };
    } catch (error: unknown) {
        const kind = classifyBookingDetailsError(error);
        if (kind === 'transient' && userId) {
            const cached = await loadOfflineBookings(userId).catch(() => null);
            const item = cached?.items.find((entry) => entry.id === bookingId);
            if (cached && item) {
                return { booking: offlineBookingToDetails(item), offlineSavedAt: cached.updatedAt };
            }
        }
        throw new BookingDetailsLoadError(kind, error);
    }
}
