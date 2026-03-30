type StaffRecord = {
    id: string;
    biz_id: string;
    user_id: string | null;
    is_active: boolean;
};

type CheckResourceLike = (
    admin: any,
    table: string,
    resourceId: string,
    bizId: string,
    select: string,
) => Promise<{ data?: StaffRecord | null; error?: unknown }>;

type ServiceClientLike = {
    from: (table: string) => any;
};

type AdminClientLike = {
    from: (table: string) => any;
};

export async function runStaffRestore({
    admin,
    roleAdmin,
    bizId,
    staffId,
    checkResourceBelongsToBiz,
}: {
    admin: ServiceClientLike;
    roleAdmin: AdminClientLike;
    bizId: string;
    staffId: string;
    checkResourceBelongsToBiz: CheckResourceLike;
}): Promise<
    | { ok: true }
    | { ok: false; error: 'not_found' | 'validation' | 'internal'; message: string; status: 404 | 400 | 500 }
> {
    const staffCheck = await checkResourceBelongsToBiz(
        admin,
        'staff',
        staffId,
        bizId,
        'id, biz_id, user_id, is_active',
    );

    if (staffCheck.error || !staffCheck.data) {
        return {
            ok: false,
            error: 'not_found',
            message: 'Сотрудник не найден',
            status: 404,
        };
    }

    const { error: updateError } = await admin
        .from('staff')
        .update({ is_active: true })
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (updateError) {
        return {
            ok: false,
            error: 'validation',
            message: updateError.message,
            status: 400,
        };
    }

    if (staffCheck.data.user_id) {
        const { data: roleStaff, error: roleError } = await roleAdmin
            .from('roles')
            .select('id')
            .eq('key', 'staff')
            .maybeSingle();

        if (roleError || !roleStaff?.id) {
            return {
                ok: false,
                error: 'internal',
                message: 'Роль staff не найдена',
                status: 500,
            };
        }

        await roleAdmin
            .from('user_roles')
            .upsert(
                { user_id: staffCheck.data.user_id, biz_id: bizId, role_id: roleStaff.id },
                { onConflict: 'user_id,role_id,biz_key' },
            );
    }

    return { ok: true };
}
