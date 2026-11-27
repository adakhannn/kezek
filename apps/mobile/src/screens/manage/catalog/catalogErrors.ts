import type { MobileI18nKey, Translate } from '../../../i18n';
import { getApiErrorStatus, getErrorMessage } from '../../../lib/errors';

/** The JSON body of a failed API answer (ApiError.details), when there is one. */
export function apiErrorBody(error: unknown): { error?: unknown; message?: unknown; details?: unknown } | null {
    const details = error && typeof error === 'object' ? (error as { details?: unknown }).details : undefined;
    return details && typeof details === 'object' ? (details as { error?: unknown; message?: unknown; details?: unknown }) : null;
}

/**
 * The text of a failed write, as the website shows it: the server's own message for a refused
 * request (validation, a limit, a conflict; the API answers in the app language), otherwise the
 * app's general error texts (no connection, session expired, server error).
 */
export function catalogErrorText(error: unknown, fallback: string, t: Translate): string {
    const status = getApiErrorStatus(error);
    const message = apiErrorBody(error)?.message;
    if (status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 429
        && typeof message === 'string' && message.trim()) {
        return message.trim();
    }
    return getErrorMessage(error, fallback, t);
}

type BookingExample = { id: string; status: string; client_name?: string | null };
type HasBookingsDetails = { total?: number; active?: number; cancelled?: number; bookings?: BookingExample[] };

const SERVICE_LABELS = {
    total: 'catalog.services.delete.totalBookings',
    active: 'catalog.services.delete.activeBookings',
    cancelled: 'catalog.services.delete.cancelledBookings',
    examples: 'catalog.services.delete.examples',
    booking: 'catalog.services.delete.bookingPrefix',
    hint: 'catalog.services.delete.hint',
} as const satisfies Record<string, MobileI18nKey>;

const BRANCH_LABELS = {
    total: 'catalog.branches.delete.error.totalBookings',
    active: 'catalog.branches.delete.error.activeBookings',
    cancelled: 'catalog.branches.delete.error.cancelledBookings',
    examples: 'catalog.branches.delete.error.examples',
    booking: 'catalog.branches.delete.error.bookingExample',
    hint: 'catalog.branches.delete.error.firstCancel',
} as const satisfies Record<string, MobileI18nKey>;

const BOOKING_STATUS_KEYS: Record<string, MobileI18nKey> = {
    hold: 'ops.bookings.status.hold',
    confirmed: 'ops.bookings.status.confirmed',
    paid: 'ops.bookings.status.paid',
    cancelled: 'ops.bookings.status.cancelled',
    no_show: 'ops.bookings.status.no_show',
};

/** The status word of an example booking ("Подтверждено"), not its code. */
function bookingStatusText(status: string, t: Translate): string {
    const key = BOOKING_STATUS_KEYS[status];
    return key ? t(key) : status;
}

/**
 * A refused delete of a service or branch with bookings (HAS_BOOKINGS): the server message, the
 * counts and a few example bookings, worded like the website's DeleteServiceButton and
 * DeleteBranchButton. Null for any other error.
 */
export function hasBookingsMessage(error: unknown, kind: 'service' | 'branch', t: Translate): string | null {
    const body = apiErrorBody(error);
    if (body?.error !== 'HAS_BOOKINGS' || !body.details || typeof body.details !== 'object') return null;
    const details = body.details as HasBookingsDetails;
    const labels = kind === 'service' ? SERVICE_LABELS : BRANCH_LABELS;
    // The service labels end without a colon, the branch labels with one (as on the website).
    const sep = kind === 'service' ? ': ' : ' ';
    let text = typeof body.message === 'string' && body.message ? body.message : String(body.error);
    text += `\n\n${t(labels.total)}${sep}${details.total ?? 0}`;
    if ((details.active ?? 0) > 0) text += `\n${t(labels.active)}${sep}${details.active}`;
    if ((details.cancelled ?? 0) > 0) text += `\n${t(labels.cancelled)}${sep}${details.cancelled}`;
    if (details.bookings && details.bookings.length > 0) {
        text += `\n\n${t(labels.examples)}${kind === 'service' ? ':' : ''}`;
        for (const booking of details.bookings) {
            const ref = kind === 'service'
                ? `${t(labels.booking)} #${booking.id.slice(0, 8)}`
                : `${t(labels.booking)}${booking.id.slice(0, 8)}`;
            text += `\n- ${ref} (${bookingStatusText(booking.status, t)})${booking.client_name ? ` - ${booking.client_name}` : ''}`;
        }
    }
    return `${text}\n\n${t(labels.hint)}`;
}
