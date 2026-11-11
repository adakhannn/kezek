/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BookingSuccess } from '../models/BookingSuccess';
import type { QuickBookGuestInput } from '../models/QuickBookGuestInput';
import type { QuickHoldInput } from '../models/QuickHoldInput';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BookingsService {
    /**
     * Confirm a guest booking
     * No login required. The caller must retain both request identity and guest proof for exact retries. Confirmation commits a durable notification event; success does not mean a message has been delivered.
     * @returns BookingSuccess Success
     * @throws ApiError
     */
    public static quickBookGuest({
        idempotencyKey,
        xBookingClientToken,
        requestBody,
    }: {
        /**
         * UUID v4 generated before sending. Reuse with identical payload for an uncertain response; a new attempt needs a new key.
         */
        idempotencyKey: string,
        /**
         * 32 cryptographically random bytes encoded as lowercase hex, retained with this attempt. Never log it.
         */
        xBookingClientToken: string,
        requestBody: QuickBookGuestInput,
    }): CancelablePromise<BookingSuccess> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/quick-book-guest',
            headers: {
                'Idempotency-Key': idempotencyKey,
                'X-Booking-Client-Token': xBookingClientToken,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid JSON, identity, shape or domain parameters.`,
                401: `Verified session required or invalid.`,
                409: `Booking attempt/slot conflict, or stale shift identity/revision/ledger. Do not silently rebase a financial draft.`,
                429: `Rate limit exceeded; inspect Retry-After.`,
                500: `Unexpected or database command failure.`,
                503: `Dependency or rate-limit readiness failure. Booking transport uncertainty must retry the exact same identity and payload.`,
            },
        });
    }
    /**
     * Confirm an authenticated booking
     * The legacy route name does not create a hold: it confirms the booking. Verified cookie/bearer session, mandatory request identity, atomic booking and notification enqueue. Repeating the same identity/payload resolves an uncertain result without creating another booking.
     * @returns BookingSuccess Success
     * @throws ApiError
     */
    public static quickHold({
        idempotencyKey,
        requestBody,
    }: {
        /**
         * UUID v4 generated before sending. Reuse with identical payload for an uncertain response; a new attempt needs a new key.
         */
        idempotencyKey: string,
        requestBody: QuickHoldInput,
    }): CancelablePromise<BookingSuccess> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/quick-hold',
            headers: {
                'Idempotency-Key': idempotencyKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid JSON, identity, shape or domain parameters.`,
                401: `Verified session required or invalid.`,
                409: `Booking attempt/slot conflict, or stale shift identity/revision/ledger. Do not silently rebase a financial draft.`,
                429: `Rate limit exceeded; inspect Retry-After.`,
                500: `Unexpected or database command failure.`,
                503: `Dependency or rate-limit readiness failure. Booking transport uncertainty must retry the exact same identity and payload.`,
            },
        });
    }
}
