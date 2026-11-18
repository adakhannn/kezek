/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CloseShiftInput } from '../models/CloseShiftInput';
import type { CloseShiftSuccess } from '../models/CloseShiftSuccess';
import type { SaveShiftItemsInput } from '../models/SaveShiftItemsInput';
import type { SaveShiftItemsSuccess } from '../models/SaveShiftItemsSuccess';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ShiftsService {
    /**
     * Close the current staff shift
     * Verified staff context. Finalizes the saved ledger under an identity/revision guard. Repeating Close for the same already-closed shift returns it; a reopened shift with an old revision conflicts. Additional notification work after the commit is not a delivery guarantee.
     * @returns CloseShiftSuccess Success
     * @throws ApiError
     */
    public static closeShift({
        requestBody,
        xKezekStaffId,
    }: {
        requestBody: CloseShiftInput,
        /**
         * The staff card (one per business) the request acts as. Required in practice for a master of several businesses: without it such a caller gets 400 with details.code STAFF_SELECTION_REQUIRED and the cards to choose from. A card that is not one of the caller's active cards gives 403 NO_STAFF_ACCESS; no active card gives 403 NO_STAFF_RECORD.
         */
        xKezekStaffId?: string,
    }): CancelablePromise<CloseShiftSuccess> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/staff/shift/close',
            headers: {
                'X-Kezek-Staff-Id': xKezekStaffId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid JSON, identity, shape or domain parameters.`,
                401: `Verified session required or invalid.`,
                403: `Caller or linked resource is not allowed for this tenant.`,
                409: `Booking attempt/slot conflict, or stale shift identity/revision/ledger. Do not silently rebase a financial draft.`,
                429: `Rate limit exceeded; inspect Retry-After.`,
                500: `Unexpected or database command failure.`,
                503: `Dependency or rate-limit readiness failure. Booking transport uncertainty must retry the exact same identity and payload.`,
            },
        });
    }
    /**
     * Replace a shift ledger using the original revision
     * Authenticated staff may save their existing shift; staffId selects manager cookie-session authorization for a tenant-owned staff member. Saves are atomic and return canonical rows/revision. A 409 requires explicit review of the preserved draft against a fresh snapshot. Serialize Save and Close; an uncertain response is not permission to overwrite using a new revision.
     * @returns SaveShiftItemsSuccess Success
     * @throws ApiError
     */
    public static saveShiftItems({
        requestBody,
        xKezekStaffId,
    }: {
        requestBody: SaveShiftItemsInput,
        /**
         * The staff card (one per business) the request acts as. Required in practice for a master of several businesses: without it such a caller gets 400 with details.code STAFF_SELECTION_REQUIRED and the cards to choose from. A card that is not one of the caller's active cards gives 403 NO_STAFF_ACCESS; no active card gives 403 NO_STAFF_RECORD.
         */
        xKezekStaffId?: string,
    }): CancelablePromise<SaveShiftItemsSuccess> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/staff/shift/items',
            headers: {
                'X-Kezek-Staff-Id': xKezekStaffId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid JSON, identity, shape or domain parameters.`,
                401: `Verified session required or invalid.`,
                403: `Caller or linked resource is not allowed for this tenant.`,
                409: `Booking attempt/slot conflict, or stale shift identity/revision/ledger. Do not silently rebase a financial draft.`,
                429: `Rate limit exceeded; inspect Retry-After.`,
                500: `Unexpected or database command failure.`,
                503: `Dependency or rate-limit readiness failure. Booking transport uncertainty must retry the exact same identity and payload.`,
            },
        });
    }
}
