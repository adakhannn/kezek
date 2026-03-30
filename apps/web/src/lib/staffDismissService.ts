import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

type StaffDismissInput = {
    admin: any;
    bizId: string;
    staffId: string;
};

type StaffDismissFailure = {
    ok: false;
    status: 400 | 404 | 409 | 500;
    error: 'validation' | 'not_found' | 'conflict' | 'internal';
    message: string;
};

type StaffDismissSuccess = {
    ok: true;
};

type StaffDismissResult = StaffDismissFailure | StaffDismissSuccess;

type StaffDismissRecord = {
    id: string;
    biz_id: string;
    user_id: string | null;
    is_active: boolean;
    full_name: string;
};

export async function runStaffDismiss({
    admin,
    bizId,
    staffId,
}: StaffDismissInput): Promise<StaffDismissResult> {
    const staffCheck = await checkResourceBelongsToBiz<StaffDismissRecord>(
        admin,
        'staff',
        staffId,
        bizId,
        'id, biz_id, user_id, is_active, full_name',
    );

    if (staffCheck.error || !staffCheck.data) {
        return {
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Сотрудник не найден',
        };
    }

    const nowIso = new Date().toISOString();
    const { count, error: bookingsError } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .neq('status', 'cancelled')
        .gt('start_at', nowIso);

    if (bookingsError) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: bookingsError.message,
        };
    }

    if ((count ?? 0) > 0) {
        return {
            ok: false,
            status: 409,
            error: 'conflict',
            message: 'У сотрудника есть будущие брони',
        };
    }

    const { error: deactivateError } = await admin
        .from('staff')
        .update({ is_active: false })
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (deactivateError) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: deactivateError.message,
        };
    }

    if (staffCheck.data.user_id) {
        const demoteResult = await demoteUserToClient(staffCheck.data.user_id, bizId);
        if (!demoteResult.ok) {
            return demoteResult;
        }
    }

    return { ok: true };
}

async function demoteUserToClient(userId: string, bizId: string): Promise<StaffDismissResult> {
    const svc = createSupabaseAdminClient();

    const { data: roleClient, error: roleError } = await svc
        .from('roles')
        .select('id')
        .eq('key', 'client')
        .maybeSingle();

    if (roleError || !roleClient?.id) {
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'Роль client не найдена',
        };
    }

    const { error: deleteError } = await svc
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('biz_id', bizId)
        .neq('role_id', roleClient.id);

    if (deleteError) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: deleteError.message,
        };
    }

    await svc.from('user_roles').upsert(
        { user_id: userId, biz_id: bizId, role_id: roleClient.id },
        { onConflict: 'user_id,role_id,biz_key' },
    );

    return { ok: true };
}
