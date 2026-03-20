import { formatInTimeZone } from 'date-fns-tz';

import { logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

import type { WorkflowError } from './shiftItemsTypes';

type ResolveShiftResult =
    | { ok: true; shiftId: string }
    | { ok: false; error: WorkflowError };

export async function resolveOpenShift(params: {
    businessTz: string;
    isOwnerMode: boolean;
    staffId: string;
    supabase: any;
    targetShiftDate?: string;
    useServiceClient: boolean;
}) : Promise<ResolveShiftResult> {
    const { businessTz, isOwnerMode, staffId, supabase, targetShiftDate, useServiceClient } = params;

    const ymd = targetShiftDate ?? formatInTimeZone(new Date(), businessTz, 'yyyy-MM-dd');

    const { data: existing, error: findError } = await supabase
        .from('staff_shifts')
        .select('id, status, shift_date')
        .eq('staff_id', staffId)
        .eq('status', 'open')
        .eq('shift_date', ymd)
        .maybeSingle();

    if (findError) {
        logError('StaffShiftItems', 'Error finding open shift', { error: findError, staffId, ymd, targetShiftDate });
        return {
            ok: false,
            error: { type: 'not_found', statusCode: 500, message: 'Не удалось найти открытую смену' },
        };
    }

    if (existing) {
        return { ok: true, shiftId: existing.id };
    }

    const { data: anyShift } = await supabase
        .from('staff_shifts')
        .select('id, status, shift_date')
        .eq('staff_id', staffId)
        .eq('shift_date', ymd)
        .maybeSingle();

    if (anyShift) {
        logError('StaffShiftItems', 'Shift exists but is not open', {
            staffId,
            ymd,
            shiftStatus: anyShift.status,
            targetShiftDate,
        });

        return {
            ok: false,
            error: {
                type: 'validation',
                statusCode: 400,
                message: `Смена за ${ymd} закрыта. Откройте смену для редактирования.`,
            },
        };
    }

    if (!isOwnerMode) {
        logError('StaffShiftItems', 'No shift found for date', { staffId, ymd, targetShiftDate });
        return {
            ok: false,
            error: {
                type: 'validation',
                statusCode: 400,
                message: 'Нет открытой смены. Сначала откройте смену.',
            },
        };
    }

    const writeClient = useServiceClient ? getServiceClient() : supabase;
    const now = new Date().toISOString();

    const { data: staffForShift, error: staffForShiftError } = await supabase
        .from('staff')
        .select('biz_id, branch_id')
        .eq('id', staffId)
        .maybeSingle();

    if (staffForShiftError || !staffForShift) {
        logError('StaffShiftItems', 'Error loading staff for shift creation', {
            error: staffForShiftError,
            staffId,
        });
        return {
            ok: false,
            error: { type: 'internal', statusCode: 500, message: 'Не удалось загрузить данные сотрудника' },
        };
    }

    const { data: newShift, error: createError } = await writeClient
        .from('staff_shifts')
        .insert({
            staff_id: staffId,
            biz_id: staffForShift.biz_id,
            branch_id: staffForShift.branch_id,
            shift_date: ymd,
            status: 'open',
            opened_at: now,
        })
        .select('id')
        .single();

    if (createError || !newShift) {
        logError('StaffShiftItems', 'Error creating shift for owner', {
            error: createError,
            staffId,
            ymd,
            targetShiftDate,
            bizId: staffForShift.biz_id,
            branchId: staffForShift.branch_id,
        });
        return {
            ok: false,
            error: { type: 'internal', statusCode: 500, message: 'Не удалось создать смену' },
        };
    }

    return { ok: true, shiftId: newShift.id };
}
