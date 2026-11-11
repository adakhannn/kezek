/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SavedShiftItem } from './SavedShiftItem';
export type SaveShiftItemsSuccess = {
    ok: boolean;
    data: {
        shiftId: string;
        revision: number;
        items: Array<SavedShiftItem>;
    };
};

