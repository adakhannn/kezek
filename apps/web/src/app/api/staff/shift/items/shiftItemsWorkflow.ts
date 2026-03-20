import { resolveShiftItemsAccess } from './shiftItemsAccess';
import { loadStaffPercentages } from './shiftItemsFinance';
import { resolveOpenShift } from './shiftItemsShiftResolver';
import type { ShiftItemsWorkflowMeta, ShiftItemsWorkflowSuccess, WorkflowError } from './shiftItemsTypes';

type ResolveShiftItemsWorkflowParams = {
    targetShiftDate?: string;
    targetStaffId?: string;
};

type ResolveShiftItemsWorkflowResult =
    | { ok: true; data: ShiftItemsWorkflowSuccess }
    | { ok: false; error: WorkflowError; meta?: ShiftItemsWorkflowMeta };

export async function resolveShiftItemsWorkflow({
    targetShiftDate,
    targetStaffId,
}: ResolveShiftItemsWorkflowParams): Promise<ResolveShiftItemsWorkflowResult> {
    const accessResult = await resolveShiftItemsAccess(targetStaffId);
    if (!accessResult.ok) {
        return accessResult;
    }

    const { bizId, businessTz, staffId, supabase, useServiceClient, userId } = accessResult.data;
    const percentages = await loadStaffPercentages(supabase, staffId);
    const shiftResult = await resolveOpenShift({
        businessTz,
        isOwnerMode: Boolean(targetStaffId),
        staffId,
        supabase,
        targetShiftDate,
        useServiceClient,
    });

    if (!shiftResult.ok) {
        return {
            ok: false,
            error: shiftResult.error,
            meta: { bizId, staffId, userId },
        };
    }

    return {
        ok: true,
        data: {
            bizId,
            businessTz,
            percentMaster: percentages.percentMaster,
            percentSalon: percentages.percentSalon,
            shiftId: shiftResult.shiftId,
            staffId,
            supabase,
            useServiceClient,
            userId,
        },
    };
}
