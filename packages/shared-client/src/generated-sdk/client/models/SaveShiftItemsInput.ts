/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShiftItemInput } from './ShiftItemInput';
/**
 * Both expected fields must refer to the draft snapshot. Both null only for a manager creating a previously absent shift on the current business-local day. For an existing shift, the stored shift date is authoritative; an explicit shiftDate must match it. Never rebase a stale draft automatically. staffId selects the manager cookie-session path; staff mode supports a verified bearer or cookie session.
 */
export type SaveShiftItemsInput = {
    items: Array<ShiftItemInput>;
    staffId?: string;
    /**
     * A real calendar date in 1900..2100.
     */
    shiftDate?: string;
    expectedShiftId: string | null;
    expectedRevision: number | null;
};

