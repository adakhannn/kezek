import type { ApiErrorResponse } from './apiErrorHandler';
import { acknowledgeBookingRequest, getBookingRequestHeaders } from './bookingRequestClient';

export type QuickHoldClientInput = {
    biz_id: string;
    branch_id?: string;
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
    code?: string;

    constructor(message: string, options?: { status?: number; details?: unknown; code?: string }) {
        super(message);
        this.name = 'QuickHoldClientError';
        this.status = options?.status ?? 500;
        this.details = options?.details;
        this.code = options?.code;
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
        requestHeaders?: (input: object, guest: boolean) => Promise<Record<string, string>>;
        acknowledgeRequest?: typeof acknowledgeBookingRequest;
    } = {},
): Promise<{ bookingId: string }> {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const requestHeaders = await (deps.requestHeaders ?? getBookingRequestHeaders)(input, false);
    const response = await fetchImpl('/api/quick-hold', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...requestHeaders },
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
            code: body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : undefined,
            details:
                body && typeof body === 'object' && 'details' in body ? body.details : undefined,
        });
    }

    const confirmed = body.data?.confirmed ?? body.confirmed;
    if (!bookingId || confirmed !== true) {
        throw new QuickHoldClientError('Booking confirmation is unavailable; retry the same request', {
            status: response.status,
            details: body,
        });
    }

    // Cleanup failure must not turn an acknowledged booking into an error. The
    // retained identity remains safe to replay if browser storage is unavailable.
    try { await (deps.acknowledgeRequest ?? acknowledgeBookingRequest)(input, false, requestHeaders); } catch { /* Keep the receipt identity. */ }
    return { bookingId };
}
