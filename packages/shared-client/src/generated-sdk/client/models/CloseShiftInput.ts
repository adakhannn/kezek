/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShiftItemInput } from './ShiftItemInput';
/**
 * The supplied items must match the saved ledger. Close finalizes saved positions; it does not save draft edits. A non-empty items array or totalAmount is required. Identity and revision belong to the original draft.
 */
export type CloseShiftInput = {
    expectedShiftId: string;
    expectedRevision: number;
    items?: Array<ShiftItemInput>;
    totalAmount?: number;
    consumablesAmount?: number;
};

