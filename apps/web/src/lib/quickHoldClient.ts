import type { ApiErrorResponse } from './apiErrorHandler';

export type QuickHoldClientInput = {
    biz_id: string;
    branch_id: string;
    service_id?: string;
    services?: { service_id: string; duration_min: number; order_index?: number }[];
    staff_id: string;
    start_at: string;
};

type QuickHoldSuccessPayload = {
    booking_id?: string;
    confirmed?: boolean;
};

type QuickHoldResponseBody =
    | ({
          ok: true;
          booking_id?: string;
          data?: QuickHoldSuccessPayload;
      } & Record<string, unknown>)
    | ApiErrorResponse;

export class QuickHoldClientError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, options?: { status?: number; details?: unknown }) {
        super(message);
        this.name = 'QuickHoldClientError';
        this.status = options?.status ?? 500;
        this.details = options?.details;
    }
}

function extractBookingId(body: QuickHoldResponseBody): string | null {
    if (!body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) {
        return null;
    }

    const directBookingId =
        'booking_id' in body && typeof body.booking_id === 'string'
            ? body.booking_id
            : null;
    if (directBookingId) {
        return directBookingId;
    }

    const nestedBookingId =
        body.data &&
        typeof body.data === 'object' &&
        'booking_id' in body.data &&
        typeof body.data.booking_id === 'string'
            ? body.data.booking_id
            : null;

    return nestedBookingId;
}

export async function createQuickHoldBooking(
    input: QuickHoldClientInput,
    deps: {
        fetchImpl?: typeof fetch;
    } = {},
): Promise<{ bookingId: string }> {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const response = await fetchImpl('/api/quick-hold', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
    });

    const body = (await response.json().catch(() => ({}))) as QuickHoldResponseBody;
    const bookingId = extractBookingId(body);

    if (!response.ok || !body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) {
        const message =
            body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
                ? body.message
                : body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
                  ? body.error
                  : 'Failed to create booking';

        throw new QuickHoldClientError(message, {
            status: response.status,
            details:
                body && typeof body === 'object' && 'details' in body ? body.details : undefined,
        });
    }

    if (!bookingId) {
        throw new QuickHoldClientError('Booking created without booking_id', {
            status: response.status,
            details: body,
        });
    }

    return { bookingId };
}
