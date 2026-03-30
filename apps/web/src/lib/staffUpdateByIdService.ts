import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logError } from '@/lib/log';
import { todayDateString } from '@/lib/time';

type StaffUpdateByIdInput = {
    admin: any;
    staffId: string;
    bizId: string;
    userId?: string;
    body: {
        full_name: string;
        email?: string | null;
        phone?: string | null;
        branch_id: string;
        is_active: boolean;
        percent_master?: number;
        percent_salon?: number;
        hourly_rate?: number | null;
    };
};

type StaffUpdateByIdFailure = {
    ok: false;
    status: 400 | 403;
    error: 'validation' | 'forbidden' | 'internal';
    message: string;
};

type StaffUpdateByIdSuccess = {
    ok: true;
    data: {
        transferred: boolean;
    };
};

type StaffUpdateByIdResult = StaffUpdateByIdFailure | StaffUpdateByIdSuccess;

type StaffRecord = {
    id: string;
    biz_id: string;
    branch_id: string;
    percent_master: number | null;
    percent_salon: number | null;
    hourly_rate: number | null;
};

export async function runStaffUpdateById({
    admin,
    staffId,
    bizId,
    userId,
    body,
}: StaffUpdateByIdInput): Promise<StaffUpdateByIdResult> {
    if (!staffId) {
        logError('StaffUpdateByIdService', 'Missing staffId');
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Отсутствует ID сотрудника',
        };
    }

    if (!body.full_name || typeof body.full_name !== 'string' || body.full_name.trim() === '') {
        logError('StaffUpdateByIdService', 'Invalid full_name', { full_name: body.full_name });
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Неверное имя сотрудника',
        };
    }

    if (!body.branch_id || typeof body.branch_id !== 'string') {
        logError('StaffUpdateByIdService', 'Invalid branch_id', { branch_id: body.branch_id });
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Неверный ID филиала',
        };
    }

    const staffCheck = await checkResourceBelongsToBiz<StaffRecord>(
        admin,
        'staff',
        staffId,
        bizId,
        'id, biz_id, branch_id, percent_master, percent_salon, hourly_rate',
    );
    if (staffCheck.error || !staffCheck.data) {
        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: staffCheck.error || 'Сотрудник не принадлежит этому бизнесу',
        };
    }

    const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string; is_active: boolean }>(
        admin,
        'branches',
        body.branch_id,
        bizId,
        'id, biz_id, is_active',
    );
    if (branchCheck.error || !branchCheck.data) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: branchCheck.error || 'Филиал не принадлежит этому бизнесу',
        };
    }

    if (branchCheck.data.is_active === false) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Целевой филиал неактивен',
        };
    }

    const updateData = buildStaffUpdatePayload(body);
    if (!updateData.ok) {
        return updateData;
    }

    const staff = staffCheck.data;
    const isBranchChanged = String(staff.branch_id) !== String(body.branch_id);

    const { error: updateError } = await admin
        .from('staff')
        .update(updateData.data)
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (updateError) {
        logError('StaffUpdateByIdService', 'Error updating staff', {
            error: updateError,
            updateData: updateData.data,
        });
        return {
            ok: false,
            status: 400,
            error: 'internal',
            message: updateError.message,
        };
    }

    await insertFinanceAuditLog({
        admin,
        bizId,
        userId,
        staffId,
        previous: staff,
        updateData: updateData.data,
    });

    if (isBranchChanged) {
        const transferResult = await transferBranchAssignment({
            admin,
            bizId,
            staffId,
            branchId: body.branch_id,
        });
        if (!transferResult.ok) {
            return transferResult;
        }
    }

    return {
        ok: true,
        data: {
            transferred: isBranchChanged,
        },
    };
}

function buildStaffUpdatePayload(body: StaffUpdateByIdInput['body']) {
    const updateData: {
        full_name: string;
        email: string | null;
        phone: string | null;
        is_active: boolean;
        percent_master?: number;
        percent_salon?: number;
        hourly_rate?: number | null;
    } = {
        full_name: body.full_name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        is_active: !!body.is_active,
    };

    if (typeof body.percent_master === 'number' && typeof body.percent_salon === 'number') {
        const sum = body.percent_master + body.percent_salon;
        if (Math.abs(sum - 100) > 0.01) {
            return {
                ok: false as const,
                status: 400 as const,
                error: 'validation' as const,
                message: 'Сумма процентов должна быть равна 100',
            };
        }
        updateData.percent_master = body.percent_master;
        updateData.percent_salon = body.percent_salon;
    }

    if (body.hourly_rate !== undefined) {
        if (body.hourly_rate === null || body.hourly_rate === undefined) {
            updateData.hourly_rate = null;
        } else {
            const numericValue = Number(body.hourly_rate);
            updateData.hourly_rate = Number.isNaN(numericValue) || numericValue <= 0 ? null : numericValue;
        }
    }

    return {
        ok: true as const,
        data: updateData,
    };
}

async function insertFinanceAuditLog({
    admin,
    bizId,
    userId,
    staffId,
    previous,
    updateData,
}: {
    admin: any;
    bizId: string;
    userId?: string;
    staffId: string;
    previous: StaffRecord;
    updateData: {
        percent_master?: number;
        percent_salon?: number;
        hourly_rate?: number | null;
    };
}) {
    const newPercentMaster =
        updateData.percent_master ?? (previous.percent_master != null ? Number(previous.percent_master) : null);
    const newPercentSalon =
        updateData.percent_salon ?? (previous.percent_salon != null ? Number(previous.percent_salon) : null);
    const newHourlyRate =
        updateData.hourly_rate !== undefined
            ? updateData.hourly_rate
            : previous.hourly_rate != null
              ? Number(previous.hourly_rate)
              : null;
    const oldPercentMaster = previous.percent_master != null ? Number(previous.percent_master) : null;
    const oldPercentSalon = previous.percent_salon != null ? Number(previous.percent_salon) : null;
    const oldHourlyRate = previous.hourly_rate != null ? Number(previous.hourly_rate) : null;

    const fieldChanges: { field: string; old_value: number | null; new_value: number | null }[] = [];
    if (oldPercentMaster !== newPercentMaster) {
        fieldChanges.push({ field: 'percent_master', old_value: oldPercentMaster, new_value: newPercentMaster });
    }
    if (oldPercentSalon !== newPercentSalon) {
        fieldChanges.push({ field: 'percent_salon', old_value: oldPercentSalon, new_value: newPercentSalon });
    }
    if (oldHourlyRate !== newHourlyRate) {
        fieldChanges.push({ field: 'hourly_rate', old_value: oldHourlyRate, new_value: newHourlyRate });
    }

    if (fieldChanges.length === 0) {
        return;
    }

    await admin.from('finance_settings_audit_log').insert({
        biz_id: bizId,
        staff_id: staffId,
        changed_by_user_id: userId ?? null,
        field_changes: fieldChanges,
        message: `Изменены настройки: ${fieldChanges
            .map((change) => `${change.field} ${change.old_value ?? '—'} → ${change.new_value ?? '—'}`)
            .join(', ')}`,
    });
}

async function transferBranchAssignment({
    admin,
    bizId,
    staffId,
    branchId,
}: {
    admin: any;
    bizId: string;
    staffId: string;
    branchId: string;
}): Promise<{ ok: true } | StaffUpdateByIdFailure> {
    const today = todayDateString();

    await admin
        .from('staff_branch_assignments')
        .update({ valid_to: today })
        .eq('staff_id', staffId)
        .is('valid_to', null);

    const { error: insertError } = await admin.from('staff_branch_assignments').insert({
        biz_id: bizId,
        staff_id: staffId,
        branch_id: branchId,
        valid_from: today,
    });
    if (insertError) {
        return {
            ok: false,
            status: 400,
            error: 'internal',
            message: insertError.message,
        };
    }

    const { error: cacheError } = await admin
        .from('staff')
        .update({ branch_id: branchId })
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (cacheError) {
        return {
            ok: false,
            status: 400,
            error: 'internal',
            message: cacheError.message,
        };
    }

    return { ok: true };
}
