import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';

type ExistingShiftRow = {
    id: string;
    status: string;
};

type StaffRow = {
    branch_id: string;
};

type AdminLikeClient = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: unknown) => {
                eq: (nestedColumn: string, nestedValue: unknown) => {
                    maybeSingle: () => Promise<{ data: unknown; error?: { message: string } | null }>;
                };
            };
        };
        update: (values: Record<string, unknown>) => {
            eq: (column: string, value: unknown) => {
                select: () => {
                    single: () => Promise<{ data: unknown; error?: { message: string } | null }>;
                };
            };
        };
        insert: (values: Record<string, unknown>) => {
            select: () => {
                single: () => Promise<{ data: unknown; error?: { message: string; code?: string; details?: string; hint?: string } | null }>;
            };
        };
    };
};

type LoadExistingShiftInput = {
    admin: AdminLikeClient;
    staffId: string;
    ymd: string;
};

type PersistOwnerShiftOpenInput = {
    admin: AdminLikeClient;
    existingShift: ExistingShiftRow | null;
    staff: StaffRow;
    staffId: string;
    bizId: string;
    ymd: string;
    openedAt: Date;
    lateMinutes: number;
};

export async function loadOwnerExistingShift(
    input: LoadExistingShiftInput
): Promise<ExistingShiftRow | null | Response> {
    const { admin, staffId, ymd } = input;
    const { data: existingShift, error: checkError } = await admin
        .from('staff_shifts')
        .select('id, status')
        .eq('staff_id', staffId)
        .eq('shift_date', ymd)
        .maybeSingle();

    if (checkError) {
        logError('OwnerShiftOpen', 'Error checking existing shift', checkError);
        return createErrorResponse('internal', 'Не удалось проверить существующую смену', undefined, 500);
    }

    return existingShift;
}

export async function persistOwnerShiftOpen(
    input: PersistOwnerShiftOpenInput
): Promise<{ shift: unknown } | Response> {
    const { admin, existingShift, staff, staffId, bizId, ymd, openedAt, lateMinutes } = input;

    if (existingShift?.status === 'open') {
        logDebug('OwnerShiftOpen', 'Shift already open, returning existing shift', {
            shiftId: existingShift.id,
            staffId,
            ymd,
        });
        return { shift: existingShift };
    }

    if (existingShift) {
        const { data: updatedShift, error: updateError } = await admin
            .from('staff_shifts')
            .update({
                status: 'open',
                opened_at: openedAt.toISOString(),
                closed_at: null,
                late_minutes: lateMinutes,
            })
            .eq('id', existingShift.id)
            .select()
            .single();

        if (updateError) {
            logError('OwnerShiftOpen', 'Error updating shift', updateError);
            return createErrorResponse('internal', 'Не удалось открыть смену', undefined, 500);
        }

        logDebug('OwnerShiftOpen', 'Shift reopened successfully', {
            shiftId: (updatedShift as { id?: string }).id,
            staffId,
            ymd,
        });

        return { shift: updatedShift };
    }

    const { data: newShift, error: createError } = await admin
        .from('staff_shifts')
        .insert({
            staff_id: staffId,
            biz_id: bizId,
            branch_id: staff.branch_id,
            shift_date: ymd,
            status: 'open',
            opened_at: openedAt.toISOString(),
            late_minutes: lateMinutes,
        })
        .select()
        .single();

    if (createError) {
        logError('OwnerShiftOpen', 'Error creating shift', {
            code: (createError as { code?: string })?.code,
            message: (createError as { message?: string })?.message,
            details: (createError as { details?: string })?.details,
            hint: (createError as { hint?: string })?.hint,
            staffId,
            bizId,
            branch_id: staff.branch_id,
            shift_date: ymd,
        });
        return createErrorResponse('internal', 'Не удалось создать смену', undefined, 500);
    }

    logDebug('OwnerShiftOpen', 'Shift opened successfully', {
        shiftId: (newShift as { id?: string }).id,
        staffId,
        ymd,
    });

    return { shift: newShift };
}
