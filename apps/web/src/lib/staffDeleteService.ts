import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';

type StaffRecord = {
    id: string;
    biz_id: string;
    user_id: string | null;
    is_active: boolean;
    full_name: string;
};

export type StaffDeleteAdminClientLike = {
    from: (table: string) => any;
};

export type StaffDeleteRoleClientLike = {
    from: (table: string) => any;
};

type StaffDeleteResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          error: string;
          message: string;
          status: number;
      };

async function demoteUserToClient(roleClient: StaffDeleteRoleClientLike, userId: string, bizId: string) {
    const roleClientResponse = (roleClient.from('roles').select('id').eq('key', 'client').maybeSingle() as Promise<{
        data: { id: string } | null;
        error: { message?: string } | null;
    }>);
    const { data: roleClientData, error: roleClientError } = await roleClientResponse;

    if (roleClientError || !roleClientData?.id) {
        return {
            ok: false as const,
            error: 'internal',
            message: 'Роль клиента не найдена',
            status: 500,
        };
    }

    const deleteResult = await roleClient
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('biz_id', bizId)
        .neq('role_id', roleClientData.id);

    if (deleteResult.error) {
        return {
            ok: false as const,
            error: 'internal',
            message: deleteResult.error.message || 'Не удалось удалить бизнес-роли пользователя',
            status: 400,
        };
    }

    await roleClient.from('user_roles').upsert(
        { user_id: userId, biz_id: bizId, role_id: roleClientData.id },
        { onConflict: 'user_id,role_id,biz_key' }
    );

    return { ok: true as const };
}

export async function runStaffDeleteService({
    admin,
    roleClient,
    bizId,
    staffId,
}: {
    admin: StaffDeleteAdminClientLike;
    roleClient: StaffDeleteRoleClientLike;
    bizId: string;
    staffId: string;
}): Promise<StaffDeleteResult> {
    const staffCheck = await checkResourceBelongsToBiz<StaffRecord>(
        admin as never,
        'staff',
        staffId,
        bizId,
        'id, biz_id, user_id, is_active, full_name'
    );

    if (staffCheck.error || !staffCheck.data) {
        return {
            ok: false,
            error: 'not_found',
            message: staffCheck.error || 'Сотрудник не найден',
            status: 404,
        };
    }

    const staff = staffCheck.data;
    const nowIso = new Date().toISOString();

    const futureBookingsResponse = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .neq('status', 'cancelled')
        .gt('start_at', nowIso);

    if (futureBookingsResponse.error) {
        return {
            ok: false,
            error: 'internal',
            message: futureBookingsResponse.error.message,
            status: 400,
        };
    }

    if ((futureBookingsResponse.count ?? 0) > 0) {
        return {
            ok: false,
            error: 'conflict',
            message: 'Невозможно удалить сотрудника: у него есть будущие активные брони. Сначала отмените все будущие брони.',
            status: 409,
        };
    }

    const cleanupSteps: Array<{ table: string; filter: (query: any) => any; message: string }> = [
        {
            table: 'bookings',
            filter: (query) => query.eq('biz_id', bizId).eq('staff_id', staffId).lt('start_at', nowIso),
            message: 'Не удалось удалить прошедшие брони',
        },
        {
            table: 'working_hours',
            filter: (query) => query.eq('biz_id', bizId).eq('staff_id', staffId),
            message: 'Не удалось удалить расписание',
        },
        {
            table: 'service_staff',
            filter: (query) => query.eq('staff_id', staffId),
            message: 'Не удалось удалить связи с услугами',
        },
        {
            table: 'staff_branch_assignments',
            filter: (query) => query.eq('biz_id', bizId).eq('staff_id', staffId),
            message: 'Не удалось удалить назначения на филиалы',
        },
        {
            table: 'staff_schedule_rules',
            filter: (query) => query.eq('biz_id', bizId).eq('staff_id', staffId),
            message: 'Не удалось удалить правила расписания',
        },
        {
            table: 'staff_time_off',
            filter: (query) => query.eq('biz_id', bizId).eq('staff_id', staffId),
            message: 'Не удалось удалить отпуска',
        },
    ];

    for (const step of cleanupSteps) {
        const result = await step.filter(admin.from(step.table).delete());
        if (result.error) {
            return {
                ok: false,
                error: 'internal',
                message: `${step.message}: ${result.error.message}`,
                status: 400,
            };
        }
    }

    if (staff.user_id) {
        const demotion = await demoteUserToClient(roleClient, staff.user_id, bizId);
        if (!demotion.ok) {
            return demotion;
        }
    }

    const deleteStaffResult = await admin.from('staff').delete().eq('id', staffId).eq('biz_id', bizId);
    if (deleteStaffResult.error) {
        return {
            ok: false,
            error: 'internal',
            message: deleteStaffResult.error.message,
            status: 400,
        };
    }

    return { ok: true };
}
