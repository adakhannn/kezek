/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * No note field is accepted. Amounts may be fractional. Omitted amounts default to zero.
 */
export type ShiftItemInput = {
    id?: string | null;
    /**
     * Stable client-generated identity for a new draft row.
     */
    clientId?: string;
    clientName?: string | null;
    serviceName?: string | null;
    serviceAmount?: number;
    consumablesAmount?: number;
    bookingId?: string | null;
    createdAt?: string | null;
};

