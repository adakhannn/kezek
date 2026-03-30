import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { toDateString } from '@/lib/time';

type StaffTransferInput = {
    admin: any;
    bizId: string;
    staffId: string;
    body: {
        target_branch_id: string;
        copy_schedule?: boolean;
    };
};

type StaffTransferFailure = {
    ok: false;
    status: 400 | 403;
    error: 'validation' | 'forbidden';
    message: string;
};

type StaffTransferSuccess = {
    ok: true;
    data?: {
        note?: string;
        warning?: string;
        detail?: string;
    };
};

type StaffTransferResult = StaffTransferFailure | StaffTransferSuccess;

export async function runStaffTransfer({
    admin,
    bizId,
    staffId,
    body,
}: StaffTransferInput): Promise<StaffTransferResult> {
    const target = body.target_branch_id?.trim();
    const copySchedule = !!body.copy_schedule;

    if (!target) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать целевой филиал',
        };
    }

    const staffCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string; branch_id: string }>(
        admin,
        'staff',
        staffId,
        bizId,
        'id, biz_id, branch_id',
    );
    if (staffCheck.error || !staffCheck.data) {
        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Сотрудник не принадлежит этому бизнесу',
        };
    }

    const staff = staffCheck.data;
    if (String(staff.branch_id) === String(target)) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Сотрудник уже находится в целевом филиале',
        };
    }

    const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string; is_active: boolean }>(
        admin,
        'branches',
        target,
        bizId,
        'id, biz_id, is_active',
    );
    if (branchCheck.error || !branchCheck.data) {
        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Филиал не принадлежит этому бизнесу',
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

    const currentAssign = await admin
        .from('staff_branch_assignments')
        .select('id,valid_from,branch_id')
        .eq('staff_id', staffId)
        .is('valid_to', null)
        .maybeSingle();

    const today = new Date();
    const todayISO = toDateString(today);
    const yesterdayISO = toDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));

    if (currentAssign.data) {
        if (String(currentAssign.data.branch_id) === String(target)) {
            return {
                ok: true,
                data: {
                    note: 'ALREADY_ACTIVE_IN_TARGET',
                },
            };
        }

        const started = String(currentAssign.data.valid_from);
        if (started >= todayISO) {
            await admin.from('staff_branch_assignments').delete().eq('id', currentAssign.data.id);
        } else {
            await admin
                .from('staff_branch_assignments')
                .update({ valid_to: yesterdayISO })
                .eq('id', currentAssign.data.id);
        }
    }

    const { data: futureAny } = await admin
        .from('staff_branch_assignments')
        .select('id')
        .eq('staff_id', staffId)
        .gte('valid_from', todayISO)
        .limit(1)
        .maybeSingle();

    if (futureAny) {
        const startNextDay = toDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
        const { error } = await admin.from('staff_branch_assignments').insert({
            biz_id: bizId,
            staff_id: staffId,
            branch_id: target,
            valid_from: startNextDay,
        });
        if (error) {
            return {
                ok: false,
                status: 400,
                error: 'validation',
                message: error.message,
            };
        }
    } else {
        const { error } = await admin.from('staff_branch_assignments').insert({
            biz_id: bizId,
            staff_id: staffId,
            branch_id: target,
            valid_from: todayISO,
        });
        if (error) {
            const startNextDay = toDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
            const { error: fallbackError } = await admin.from('staff_branch_assignments').insert({
                biz_id: bizId,
                staff_id: staffId,
                branch_id: target,
                valid_from: startNextDay,
            });
            if (fallbackError) {
                return {
                    ok: false,
                    status: 400,
                    error: 'validation',
                    message: fallbackError.message,
                };
            }
        }
    }

    const { error: updateError } = await admin
        .from('staff')
        .update({ branch_id: target })
        .eq('id', staffId)
        .eq('biz_id', bizId);
    if (updateError) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: updateError.message,
        };
    }

    if (copySchedule && staff.branch_id) {
        const { data: workingHours } = await admin
            .from('working_hours')
            .select('day_of_week, intervals, breaks')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId);

        if (workingHours?.length) {
            await admin.from('working_hours').delete().eq('biz_id', bizId).eq('staff_id', staffId);

            const rows = workingHours.map((row: { day_of_week: number; intervals?: unknown; breaks?: unknown }) => ({
                biz_id: bizId,
                staff_id: staffId,
                day_of_week: row.day_of_week,
                intervals: row.intervals ?? [],
                breaks: row.breaks ?? [],
            }));
            const { error: copyError } = await admin.from('working_hours').insert(rows);
            if (copyError) {
                return {
                    ok: true,
                    data: {
                        warning: 'SCHEDULE_COPY_FAILED',
                        detail: copyError.message,
                    },
                };
            }
        }
    }

    return { ok: true };
}
