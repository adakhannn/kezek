import type { SupabaseClient } from '@supabase/supabase-js';

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { logDebug, logError, logWarn } from '@/lib/log';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { initializeStaffSchedule } from '@/lib/staffSchedule';
import { todayDateString } from '@/lib/time';

type StaffCreateFromUserInput = {
    admin: SupabaseClient;
    bizId: string;
    body: {
        user_id: string;
        branch_id: string;
        is_active?: boolean;
    };
};

type StaffCreateFromUserFailure = {
    ok: false;
    status: 400 | 403 | 404 | 500;
    error: 'validation' | 'forbidden' | 'not_found' | 'internal';
    message: string;
};

type StaffCreateFromUserSuccess = {
    ok: true;
    data: {
        id: string;
        schedule_initialized: boolean;
        schedule_days_created: number;
        schedule_error: string | null;
    };
};

type StaffCreateFromUserResult =
    | StaffCreateFromUserFailure
    | StaffCreateFromUserSuccess;

export async function runStaffCreateFromUser({
    admin,
    bizId,
    body,
}: StaffCreateFromUserInput): Promise<StaffCreateFromUserResult> {
    if (!body.user_id || !body.branch_id) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'user_id и branch_id обязательны',
        };
    }

    const branchCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
        admin,
        'branches',
        body.branch_id,
        bizId,
        'id, biz_id',
    );
    if (branchCheck.error || !branchCheck.data) {
        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Филиал не принадлежит этому бизнесу',
        };
    }

    const { data: list, error: listError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
    });
    if (listError) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: listError.message,
        };
    }

    const user = (list.users ?? []).find((candidate: { id: string }) => candidate.id === body.user_id);
    if (!user) {
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Пользователь не найден',
        };
    }

    const meta = user.user_metadata ?? {};
    const fullName = String(meta.full_name ?? meta.fullName ?? user.email ?? 'Без имени');
    const email = user.email ?? null;
    const phone = user.phone ?? null;

    const { data: existingStaff } = await admin
        .from('staff')
        .select('id')
        .eq('biz_id', bizId)
        .eq('full_name', fullName)
        .limit(1)
        .maybeSingle();

    let staffId = existingStaff?.id as string | undefined;

    if (!staffId) {
        const { data: inserted, error: insertError } = await admin
            .from('staff')
            .insert({
                biz_id: bizId,
                branch_id: body.branch_id,
                full_name: fullName,
                email,
                phone,
                is_active: body.is_active ?? true,
                user_id: body.user_id,
            })
            .select('id')
            .single();

        if (insertError) {
            return {
                ok: false,
                status: 400,
                error: 'validation',
                message: insertError.message,
            };
        }

        staffId = inserted?.id as string | undefined;
    } else {
        const { data: staffRecord } = await admin
            .from('staff')
            .select('user_id')
            .eq('id', staffId)
            .maybeSingle();

        if (staffRecord && !staffRecord.user_id) {
            await admin
                .from('staff')
                .update({ user_id: body.user_id })
                .eq('id', staffId);
        }
    }

    await ensureStaffBranchAssignment({
        admin,
        bizId,
        branchId: body.branch_id,
        staffId,
    });

    const grantRoleResult = await ensureStaffRole({
        admin,
        bizId,
        userId: body.user_id,
    });
    if (!grantRoleResult.ok) {
        return grantRoleResult;
    }

    const scheduleResult = explicitSchedulingEnabled() ? { success: false, daysCreated: 0, error: undefined } : await initializeSchedule({
        admin,
        bizId,
        branchId: body.branch_id,
        staffId,
    });

    if (!staffId) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'Не удалось получить id сотрудника',
        };
    }

    return {
        ok: true,
        data: {
            id: staffId,
            schedule_initialized: scheduleResult.success,
            schedule_days_created: scheduleResult.daysCreated,
            schedule_error: scheduleResult.error || null,
        },
    };
}

async function ensureStaffBranchAssignment({
    admin,
    bizId,
    branchId,
    staffId,
}: {
    admin: SupabaseClient;
    bizId: string;
    branchId: string;
    staffId: string | undefined;
}): Promise<void> {
    if (!staffId) {
        return;
    }

    try {
        const todayISO = todayDateString();
        const { data: existingAssign } = await admin
            .from('staff_branch_assignments')
            .select('id')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('branch_id', branchId)
            .is('valid_to', null)
            .maybeSingle();

        if (!existingAssign) {
            const { error } = await admin.from('staff_branch_assignments').insert({
                biz_id: bizId,
                staff_id: staffId,
                branch_id: branchId,
                valid_from: todayISO,
            });
            if (error) {
                logWarn('StaffCreateFromUserService', 'Failed to create staff_branch_assignments row', {
                    message: error.message,
                });
            }
        }
    } catch (error) {
        logWarn('StaffCreateFromUserService', 'Unexpected error while creating staff_branch_assignments row', error);
    }
}

async function ensureStaffRole({
    admin,
    bizId,
    userId,
}: {
    admin: SupabaseClient;
    bizId: string;
    userId: string;
}): Promise<{ ok: true } | StaffCreateFromUserFailure> {
    const { data: roleStaff } = await admin
        .from('roles')
        .select('id')
        .eq('key', 'staff')
        .maybeSingle();

    if (!roleStaff?.id) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'Роль staff не найдена',
        };
    }

    const { data: existsRole } = await admin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', roleStaff.id)
        .eq('biz_id', bizId)
        .maybeSingle();

    if (!existsRole) {
        const { error } = await admin.from('user_roles').insert({
            user_id: userId,
            role_id: roleStaff.id,
            biz_id: bizId,
        });

        if (error) {
            return {
                ok: false,
                status: 400,
                error: 'validation',
                message: error.message,
            };
        }
    }

    return { ok: true };
}

async function initializeSchedule({
    admin,
    bizId,
    branchId,
    staffId,
}: {
    admin: SupabaseClient;
    bizId: string;
    branchId: string;
    staffId: string | undefined;
}) {
    let scheduleResult: Awaited<ReturnType<typeof initializeStaffSchedule>> = {
        success: false,
        daysCreated: 0,
    };

    if (!staffId) {
        logWarn('StaffCreateFromUserService', 'No staff ID, cannot initialize schedule');
        return scheduleResult;
    }

    logDebug('StaffCreateFromUserService', 'Initializing schedule for new staff', {
        staffId,
        branchId,
    });

    try {
        scheduleResult = await initializeStaffSchedule(admin, bizId, staffId, branchId);
        logDebug('StaffCreateFromUserService', 'Schedule initialization completed', {
            staffId,
            result: scheduleResult,
        });
    } catch (scheduleError) {
        const errorMessage =
            scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
        logError('StaffCreateFromUserService', 'Schedule initialization failed', {
            staffId,
            error: errorMessage,
        });
        scheduleResult = {
            success: false,
            daysCreated: 0,
            error: errorMessage,
        };
    }

    return scheduleResult;
}
