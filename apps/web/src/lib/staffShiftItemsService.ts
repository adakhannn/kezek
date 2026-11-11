import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';

import { financeCommandFailure } from '@/lib/staffShift/financeCommand';
import { getServiceClient } from '@/lib/supabaseService';
import type { shiftItemSchema } from '@/lib/validation/schemas';

type SaveShiftItemsParams = {
    supabase: Pick<SupabaseClient, 'from' | 'rpc' | 'auth'>;
    staffId: string;
    bizId: string;
    actorId: string;
    items: z.infer<typeof shiftItemSchema>[];
    targetShiftDate?: string;
    isOwnerMode: boolean;
    useServiceClient: boolean;
    expectedShiftId: string | null;
    expectedRevision: number | null;
};

/** A replacement ledger is one command: no HTTP-level per-item writes or partial fallbacks. */
export async function runSaveStaffShiftItems(params: SaveShiftItemsParams) {
    const { supabase, staffId, bizId, actorId, items, targetShiftDate, isOwnerMode, useServiceClient, expectedRevision, expectedShiftId } = params;
    if (!actorId) return financeCommandFailure({ code: '42501' });
    let client = supabase;
    if (useServiceClient) {
        try { client = getServiceClient(); } catch { /* The checked RPC also supports the authenticated client. */ }
    }
    const { data, error } = await client.rpc('save_staff_shift_command', {
        p_staff_id: staffId,
        p_biz_id: bizId,
        p_actor_id: actorId,
        p_shift_date: targetShiftDate ?? null,
        p_items: items,
        p_allow_create: isOwnerMode,
        p_expected_revision: expectedRevision,
        p_expected_shift_id: expectedShiftId,
    });
    if (error) return financeCommandFailure(error);
    if (!data || data.ok !== true || typeof data.shift_id !== 'string' ||
        !Number.isSafeInteger(data.revision) || !Array.isArray(data.items)) {
        return financeCommandFailure({ message: 'Invalid save response' });
    }
    return { ok: true as const, data: { shiftId: data.shift_id as string, revision: data.revision as number,
        items: data.items as z.infer<typeof shiftItemSchema>[] } };
}
