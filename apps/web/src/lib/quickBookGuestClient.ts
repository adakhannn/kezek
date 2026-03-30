import type { ApiErrorResponse } from './apiErrorHandler';

export type QuickBookGuestClientInput = {
    biz_id: string;
    branch_id: string;
    service_id?: string;
    services?: { service_id: string; duration_min: number; order_index?: number }[];
    staff_id: string;
    start_at: string;
    client_name: string;
    client_phone: string;
    client_email?: string | null;
};

type QuickBookGuestSuccessPayload = {
    booking_id?: string;
    confirmed?: boolean;
};

type QuickBookGuestResponseBody =
    | ({
          ok: true;
          booking_id?: string;
          data?: QuickBookGuestSuccessPayload;
      } & Record<string, unknown>)
    | ApiErrorResponse;

export class QuickBookGuestClientError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, options?: { status?: number; details?: unknown }) {
        super(message);
        this.name = 'QuickBookGuestClientError';
        this.status = options?.status ?? 500;
        this.details = options?.details;
    }
}

function extractBookingId(body: QuickBookGuestResponseBody): string | null {
    if (!body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) {
        return null;
    }

    if ('booking_id' in body && typeof body.booking_id === 'string') {
        return body.booking_id;
    }

    if (
        body.data &&
        typeof body.data === 'object' &&
        'booking_id' in body.data &&
        typeof body.data.booking_id === 'string'
    ) {
        return body.data.booking_id;
    }

    return null;
}

export async function createGuestBookingRequest(
    input: QuickBookGuestClientInput,
    deps: {
        fetchImpl?: typeof fetch;
    } = {},
): Promise<{ bookingId: string }> {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const response = await fetchImpl('/api/quick-book-guest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
    });

    const body = (await response.json().catch(() => ({}))) as QuickBookGuestResponseBody;
    const bookingId = extractBookingId(body);

    if (!response.ok || !body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) {
        const message =
            body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
                ? body.message
                : body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
                  ? body.error
                  : 'Failed to create guest booking';

        throw new QuickBookGuestClientError(message, {
            status: response.status,
            details:
                body && typeof body === 'object' && 'details' in body ? body.details : undefined,
        });
    }

    if (!bookingId) {
        throw new QuickBookGuestClientError('Booking created without booking_id', {
            status: response.status,
            details: body,
        });
    }

    return { bookingId };
}
