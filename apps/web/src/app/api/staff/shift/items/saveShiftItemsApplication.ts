import { getServiceClient } from '@/lib/supabaseService';

import { saveShiftItemsForShift } from './shiftItemsService';
import type { ShiftItemsWorkflowMeta, WorkflowError } from './shiftItemsTypes';
import { resolveShiftItemsWorkflow } from './shiftItemsWorkflow';

type ShiftItemInput = {
    id?: string | null;
    clientName?: string | null;
    client_name?: string | null;
    serviceName?: string | null;
    service_name?: string | null;
    serviceAmount?: number | null;
    amount?: number | null;
    consumablesAmount?: number | null;
    consumables_amount?: number | null;
    bookingId?: string | null;
    booking_id?: string | null;
};

type SaveShiftItemsApplicationParams = {
    items: ShiftItemInput[];
    targetShiftDate?: string;
    targetStaffId?: string;
};

type SaveShiftItemsApplicationResult =
    | {
          ok: true;
          meta: {
              bizId?: string;
              staffId?: string;
              userId?: string;
          };
      }
    | {
          ok: false;
          error: WorkflowError;
          meta?: ShiftItemsWorkflowMeta;
      };

export async function saveShiftItemsApplication({
    items,
    targetShiftDate,
    targetStaffId,
}: SaveShiftItemsApplicationParams): Promise<SaveShiftItemsApplicationResult> {
    const workflowResult = await resolveShiftItemsWorkflow({
        targetStaffId,
        targetShiftDate,
    });

    if (!workflowResult.ok) {
        return workflowResult;
    }

    const {
        bizId,
        percentMaster,
        percentSalon,
        shiftId,
        staffId,
        supabase,
        useServiceClient,
        userId,
    } = workflowResult.data;

    const writeClient = useServiceClient ? getServiceClient() : supabase;
    const saveResult = await saveShiftItemsForShift({
        items,
        shiftId,
        staffId,
        percentMaster,
        percentSalon,
        readClient: supabase,
        writeClient,
    });

    if (!saveResult.ok) {
        return {
            ok: false,
            error: saveResult.error,
            meta: { bizId, staffId, userId },
        };
    }

    return {
        ok: true,
        meta: { bizId, staffId, userId },
    };
}
