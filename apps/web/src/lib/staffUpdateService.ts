import type { SupabaseClient } from '@supabase/supabase-js';

import { logWarn } from '@/lib/log';

type StaffUpdateInput = {
    supabase: SupabaseClient;
    admin: SupabaseClient;
    staffId: string;
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

type StaffUpdateFailure = {
    ok: false;
    status: 400 | 403;
    error: 'validation' | 'forbidden' | 'internal';
    message: string;
};

type StaffUpdateSuccess = {
    ok: true;
    data: {
        user_linked: boolean;
    };
};

type StaffUpdateResult = StaffUpdateFailure | StaffUpdateSuccess;

export async function runStaffUpdate({
    supabase,
    admin,
    staffId,
    userId,
    bizId,
    body,
}: StaffUpdateInput): Promise<StaffUpdateResult> {
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
            message: 'Необходимо указать имя и филиал',
        };
    }

    const linkedUserId = await resolveLinkedUserId({
        admin,
        email: body.email,
        phone: body.phone,
    });

    const { error } = await supabase
        .from('staff')
        .update({
            full_name: body.full_name,
            email: body.email ?? null,
            phone: body.phone ?? null,
            branch_id: body.branch_id,
            is_active: body.is_active,
            user_id: linkedUserId,
        })
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (error) {
        return {
            ok: false,
            status: 400,
            error: 'internal',
            message: error.message.includes('SCHEDULE_USE_TRANSFER_COMMAND')
                ? 'Для смены филиала используйте «Перевести сотрудника» в карточке. Остальные изменения не сохранены.'
                : error.message,
        };
    }

    if (linkedUserId) {
        await addStaffRole(admin, linkedUserId, bizId);
    }

    return {
        ok: true,
        data: {
            user_linked: !!linkedUserId,
        },
    };
}

async function checkManagerRoleAccess({
    supabase,
    userId,
    bizId,
}: {
    supabase: SupabaseClient;
    userId: string;
    bizId: string;
}) {
    const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(key)')
        .eq('user_id', userId)
        .eq('biz_id', bizId);

    return (roles ?? []).some((roleRow: unknown) => {
        if (!roleRow || typeof roleRow !== 'object' || !('roles' in roleRow)) {
            return false;
        }
        const roleObj = (roleRow as { roles?: { key?: unknown } | null }).roles;
        if (!roleObj || typeof roleObj !== 'object' || !('key' in roleObj)) {
            return false;
        }
        const key = roleObj.key;
        return typeof key === 'string' && ['owner', 'admin', 'manager'].includes(key);
    });
}

async function resolveLinkedUserId({
    admin,
    email,
    phone,
}: {
    admin: SupabaseClient;
    email?: string | null;
    phone?: string | null;
}) {
    if (!email && !phone) {
        return null;
    }

    const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const foundUser = userList?.users?.find((user: { id: string; email?: string; phone?: string }) => {
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

async function addStaffRole(admin: SupabaseClient, userId: string, bizId: string) {
    const { data: roleStaff } = await admin
        .from('roles')
        .select('id')
        .eq('key', 'staff')
        .maybeSingle();

    if (!roleStaff?.id) {
        logWarn('StaffUpdateService', 'Staff role not found in roles table');
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
            biz_key: bizId,
        });
        if (error) {
            logWarn('StaffUpdateService', 'Failed to add staff role', error);
        }
    }
}
