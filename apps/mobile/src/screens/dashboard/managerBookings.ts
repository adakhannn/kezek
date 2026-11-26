import { apiRequest } from '../../lib/api';
import type { ManagerBooking, ManagerBookingAction, ManagerBookingsScope } from './types';

export const MANAGER_BOOKINGS_PAGE_SIZE = 30;

type PageEnvelope = {
    ok?: boolean;
    data?: ManagerBooking[];
    page?: { next_offset?: number | null };
    timezone?: string;
};

export type ManagerBookingsPage = { items: ManagerBooking[]; nextOffset: number | null; timezone: string | null };

export async function fetchManagerBookingsPage(bizId: string, scope: ManagerBookingsScope, offset: number): Promise<ManagerBookingsPage> {
    const query = `bizId=${encodeURIComponent(bizId)}&scope=${scope}&limit=${MANAGER_BOOKINGS_PAGE_SIZE}&offset=${offset}`;
    const response = await apiRequest<PageEnvelope>(`/api/mobile/manager/bookings?${query}`);
    if (!response?.ok || !Array.isArray(response.data)) throw new Error('Unexpected manager bookings response');
    return { items: response.data, nextOffset: response.page?.next_offset ?? null, timezone: response.timezone ?? null };
}

/**
 * What the manager may do with a booking in the app (O1), the server's rules: confirm a pending
 * booking; cancel a pending or confirmed one; mark attendance (paid / no-show) once it has started.
 * Paid, no-show and cancelled bookings are final here; corrections stay on the website.
 */
export function availableManagerActions(booking: Pick<ManagerBooking, 'status' | 'start_at'>, now: Date): ManagerBookingAction[] {
    const open = booking.status === 'hold' || booking.status === 'confirmed';
    if (!open) return [];
    const started = new Date(booking.start_at).getTime() <= now.getTime();
    return [
        ...(booking.status === 'hold' ? ['confirm' as const] : []),
        ...(started ? ['attended' as const, 'no_show' as const] : []),
        'cancel' as const,
    ];
}

/** Runs one action through the website's Bearer-capable endpoints. */
export async function runManagerBookingAction(bookingId: string, action: ManagerBookingAction): Promise<void> {
    const id = encodeURIComponent(bookingId);
    if (action === 'confirm') {
        await apiRequest(`/api/bookings/${id}/confirm`, { method: 'POST' });
    } else if (action === 'cancel') {
        await apiRequest(`/api/bookings/${id}/cancel`, { method: 'POST' });
    } else {
        await apiRequest(`/api/bookings/${id}/mark-attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attended: action === 'attended' }),
        });
    }
}
