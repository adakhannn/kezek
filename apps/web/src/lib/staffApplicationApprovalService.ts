import { initializeStaffSchedule } from '@/lib/staffSchedule';

type DbClient = {
    // Generated Supabase types are not fully synchronized in this repository.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc: (name: string, params: Record<string, unknown>) => any;
};

type ApprovalFailure = {
    ok: false;
    status: 400 | 403 | 404 | 409 | 500;
    message: string;
};

type ApprovalSuccess = {
    ok: true;
    staffId: string;
    bizId: string;
    branchId: string;
    schedule: {
        initialized: boolean;
        daysCreated: number;
        error: string | null;
    };
};

export async function isBusinessOwner(params: {
    admin: DbClient;
    userId: string;
    bizId: string;
}) {
    const { data: business, error: businessError } = await params.admin
        .from('businesses')
        .select('owner_id')
        .eq('id', params.bizId)
        .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (business?.owner_id === params.userId) return true;

    const { data: ownerRole, error: roleError } = await params.admin
        .from('roles')
        .select('id')
        .eq('key', 'owner')
        .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!ownerRole?.id) return false;

    const { data: assignment, error: assignmentError } = await params.admin
        .from('user_roles')
        .select('id')
        .eq('user_id', params.userId)
        .eq('biz_id', params.bizId)
        .eq('role_id', ownerRole.id)
        .maybeSingle();
    if (assignmentError) throw new Error(assignmentError.message);

    return !!assignment;
}

function mapApprovalError(error: { code?: string; message?: string }): ApprovalFailure {
    const message = error.message || 'Не удалось принять сотрудника.';
    if (message.includes('application_not_found')) {
        return { ok: false, status: 404, message: 'Заявка не найдена.' };
    }
    if (message.includes('application_already_processed') || error.code === '23505') {
        return { ok: false, status: 409, message: 'Заявка уже обработана.' };
    }
    if (message.includes('invalid_or_inactive_branch')) {
        return { ok: false, status: 400, message: 'Выбранный филиал не найден или неактивен.' };
    }
    if (message.includes('application_is_not_staff')) {
        return { ok: false, status: 400, message: 'Эта заявка не является заявкой сотрудника.' };
    }
    if (message.includes('staff_role_not_found')) {
        return { ok: false, status: 500, message: 'Роль сотрудника не настроена в системе.' };
    }
    return { ok: false, status: 400, message };
}

export async function approveStaffApplication(params: {
    admin: DbClient;
    applicationId: string;
    reviewerUserId: string;
    branchId: string;
    isActive: boolean;
}): Promise<ApprovalFailure | ApprovalSuccess> {
    const { data, error } = await params.admin.rpc('approve_staff_application', {
        p_application_id: params.applicationId,
        p_reviewer_user_id: params.reviewerUserId,
        p_branch_id: params.branchId,
        p_is_active: params.isActive,
    });

    if (error) return mapApprovalError(error);

    const row = Array.isArray(data) ? data[0] : data;
    const staffId = typeof row?.staff_id === 'string' ? row.staff_id : '';
    const bizId = typeof row?.biz_id === 'string' ? row.biz_id : '';
    const branchId = typeof row?.branch_id === 'string' ? row.branch_id : '';
    if (!staffId || !bizId || !branchId) {
        return {
            ok: false,
            status: 500,
            message: 'Сотрудник создан, но база не вернула его рабочий контекст.',
        };
    }

    const scheduleResult = await initializeStaffSchedule(
        // The runtime admin client implements the same query interface expected by the helper.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params.admin as any,
        bizId,
        staffId,
        branchId,
    );

    return {
        ok: true,
        staffId,
        bizId,
        branchId,
        schedule: {
            initialized: scheduleResult.success,
            daysCreated: scheduleResult.daysCreated,
            error: scheduleResult.error ?? null,
        },
    };
}
