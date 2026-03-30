import { logDebug, logError, logWarn } from '@/lib/log';
import { initializeStaffSchedule } from '@/lib/staffSchedule';
import { todayDateString } from '@/lib/time';

type StaffCreateInput = {
    supabase: any;
    admin: any;
    userId: string;
    bizId: string;
    body: {
        full_name: string;
        email?: string | null;
        phone?: string | null;
        branch_id: string;
        is_active: boolean;
    };
};

type StaffCreateFailure = {
    ok: false;
    status: 400 | 403 | 500;
    error: 'validation' | 'forbidden' | 'internal';
    message: string;
};

type StaffCreateSuccess = {
    ok: true;
    data: {
        id: string;
        user_linked: boolean;
        schedule_initialized: boolean;
        schedule_days_created: number;
        schedule_error: string | null;
    };
};

type StaffCreateResult = StaffCreateFailure | StaffCreateSuccess;

export async function runStaffCreate({
    supabase,
    admin,
    userId,
    bizId,
    body,
}: StaffCreateInput): Promise<StaffCreateResult> {
    const hasAccess = await checkManagerRoleAccess({ supabase, userId, bizId });
    if (!hasAccess) {
        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Доступ запрещен',
        };
    }

    if (!body.full_name || !body.branch_id) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Имя и филиал обязательны',
        };
    }

    const linkedUserId = await resolveLinkedUserId({
        admin,
        email: body.email,
        phone: body.phone,
    });

    const { data, error } = await supabase
        .from('staff')
        .insert({
            biz_id: bizId,
            branch_id: body.branch_id,
            full_name: body.full_name,
            email: body.email ?? null,
            phone: body.phone ?? null,
            is_active: !!body.is_active,
            user_id: linkedUserId,
        })
        .select('id')
        .single();

    if (error) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: error.message,
        };
    }

    const staffId = data?.id as string | undefined;
    await createInitialBranchAssignment({
        admin,
        bizId,
        branchId: body.branch_id,
        staffId,
    });

    if (linkedUserId) {
        await addStaffRole(admin, linkedUserId, bizId);
    }

    const scheduleResult = await initializeSchedule({
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
            user_linked: !!linkedUserId,
            schedule_initialized: scheduleResult.success,
            schedule_days_created: scheduleResult.daysCreated,
            schedule_error: scheduleResult.error || null,
        },
    };
}

async function checkManagerRoleAccess({
    supabase,
    userId,
    bizId,
}: {
    supabase: any;
    userId: string;
    bizId: string;
}) {
    const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(key)')
        .eq('user_id', userId)
        .eq('biz_id', bizId);

    type RoleRow = { roles: { key: string } | null };
    const rolesArray = (roles ?? []) as RoleRow[];
    return rolesArray.some((roleRow) =>
        roleRow.roles?.key && ['owner', 'admin', 'manager'].includes(roleRow.roles.key),
    );
}

async function resolveLinkedUserId({
    admin,
    email,
    phone,
}: {
    admin: any;
    email?: string | null;
    phone?: string | null;
}) {
    if (!email && !phone) {
        return null;
    }

    const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const foundUser = userList?.users?.find((user: { email?: string; phone?: string; id: string }) => {
        if (email && user.email === email) {
            return true;
        }
        if (phone && user.phone === phone) {
            return true;
        }
        return false;
    });

    return foundUser?.id ?? null;
}

async function createInitialBranchAssignment({
    admin,
    bizId,
    branchId,
    staffId,
}: {
    admin: any;
    bizId: string;
    branchId: string;
    staffId: string | undefined;
}) {
    try {
        const todayISO = todayDateString();
        const { error } = await admin.from('staff_branch_assignments').insert({
            biz_id: bizId,
            staff_id: staffId,
            branch_id: branchId,
            valid_from: todayISO,
        });
        if (error) {
            logWarn('StaffCreateService', 'Failed to create initial staff_branch_assignments row', {
                message: error.message,
            });
        }
    } catch (error) {
        logWarn('StaffCreateService', 'Unexpected error while creating staff_branch_assignments row', error);
    }
}

async function addStaffRole(admin: any, userId: string, bizId: string): Promise<void> {
    const { data: roleStaff } = await admin
        .from('roles')
        .select('id')
        .eq('key', 'staff')
        .maybeSingle();

    if (!roleStaff?.id) {
        logWarn('StaffCreateService', 'Staff role not found in roles table');
        return;
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
            biz_id: bizId,
            role_id: roleStaff.id,
        });
        if (error) {
            logWarn('StaffCreateService', 'Failed to add staff role', { message: error.message });
        }
    }
}

async function initializeSchedule({
    admin,
    bizId,
    branchId,
    staffId,
}: {
    admin: any;
    bizId: string;
    branchId: string;
    staffId: string | undefined;
}) {
    let scheduleResult: Awaited<ReturnType<typeof initializeStaffSchedule>> = {
        success: false,
        daysCreated: 0,
    };

    if (!staffId) {
        logWarn('StaffCreateService', 'No staff ID returned, cannot initialize schedule');
        return scheduleResult;
    }

    logDebug('StaffCreateService', 'Initializing schedule for new staff', {
        staffId,
        branchId,
    });

    try {
        scheduleResult = await initializeStaffSchedule(admin, bizId, staffId, branchId);
        logDebug('StaffCreateService', 'Schedule initialization completed', {
            staffId,
            result: scheduleResult,
        });
    } catch (scheduleError) {
        const errorMessage =
            scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
        logError('StaffCreateService', 'Schedule initialization failed', {
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
