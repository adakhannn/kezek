type ManagerSupabaseLike = {
    auth: {
        getUser: () => Promise<{ data: { user: { id: string } | null } }>;
    };
    from: (table: string) => any;
};

type AdminLike = {
    from: (table: string) => any;
};

export async function runStaffSyncRoles({
    supabase,
    admin,
    bizId,
}: {
    supabase: ManagerSupabaseLike;
    admin: AdminLike;
    bizId: string;
}): Promise<
    | { ok: true; data: { synced: number; message: string } | { synced: number; total: number; errors: string[] | undefined } }
    | { ok: false; error: 'auth' | 'forbidden' | 'not_found' | 'internal'; message: string; status: 401 | 403 | 400 }
> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return {
            ok: false,
            error: 'auth',
            message: 'Не авторизован',
            status: 401,
        };
    }

    const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(key)')
        .eq('user_id', user.id)
        .eq('biz_id', bizId);

    const hasAccess = (roles ?? []).some((row: unknown) => {
        if (!row || typeof row !== 'object' || !('roles' in row)) return false;
        const roleObj = (row as { roles?: { key?: unknown } | null }).roles;
        if (!roleObj || typeof roleObj !== 'object' || !('key' in roleObj)) return false;
        const key = roleObj.key;
        return typeof key === 'string' && ['owner', 'admin', 'manager'].includes(key);
    });

    if (!hasAccess) {
        return {
            ok: false,
            error: 'forbidden',
            message: 'Доступ запрещен',
            status: 403,
        };
    }

    const { data: roleStaff } = await admin
        .from('roles')
        .select('id')
        .eq('key', 'staff')
        .maybeSingle();

    if (!roleStaff?.id) {
        return {
            ok: false,
            error: 'not_found',
            message: 'Роль staff не найдена',
            status: 400,
        };
    }

    const { data: staffList, error: staffError } = await admin
        .from('staff')
        .select('id, user_id, full_name')
        .eq('biz_id', bizId)
        .eq('is_active', true)
        .not('user_id', 'is', null);

    if (staffError) {
        return {
            ok: false,
            error: 'internal',
            message: staffError.message,
            status: 400,
        };
    }

    if (!staffList || staffList.length === 0) {
        return {
            ok: true,
            data: { synced: 0, message: 'No staff with user_id found' },
        };
    }

    let synced = 0;
    const errors: string[] = [];

    for (const staff of staffList) {
        if (!staff.user_id) continue;

        const { data: existsRole } = await admin
            .from('user_roles')
            .select('id')
            .eq('user_id', staff.user_id)
            .eq('role_id', roleStaff.id)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (!existsRole) {
            const { error } = await admin.from('user_roles').insert({
                user_id: staff.user_id,
                biz_id: bizId,
                role_id: roleStaff.id,
                biz_key: bizId,
            });

            if (error) {
                errors.push(`${staff.full_name}: ${error.message}`);
            } else {
                synced++;
            }
        }
    }

    return {
        ok: true,
        data: {
            synced,
            total: staffList.length,
            errors: errors.length > 0 ? errors : undefined,
        },
    };
}
