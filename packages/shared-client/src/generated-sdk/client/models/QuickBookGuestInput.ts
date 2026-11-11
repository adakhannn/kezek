/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BookingServiceInput } from './BookingServiceInput';
/**
 * Unknown keys are stripped. Business rules and service availability are validated on the server.
 */
export type QuickBookGuestInput = {
    biz_id: string;
    branch_id: string;
    staff_id: string;
    service_id?: string;
    services?: Array<BookingServiceInput>;
    /**
     * A valid date with seconds and timezone; fractional seconds are not accepted by the HTTP validator.
     */
    start_at: string;
    /**
     * Must contain non-whitespace characters.
     */
    client_name: string;
    client_phone: string;
    client_email?: string | null;
};

