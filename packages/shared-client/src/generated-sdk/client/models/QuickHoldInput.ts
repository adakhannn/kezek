/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BookingServiceInput } from './BookingServiceInput';
/**
 * Either service_id or a non-empty services array is required. If services is supplied it must be non-empty even when service_id is also supplied. Unknown keys are stripped. Calendar, schedule and tenant validity are enforced by the server.
 */
export type QuickHoldInput = {
    biz_id: string;
    branch_id?: string;
    staff_id: string;
    service_id?: string;
    services?: Array<BookingServiceInput>;
    /**
     * A valid date with seconds and timezone; fractional seconds are not accepted by the HTTP validator.
     */
    start_at: string;
};

