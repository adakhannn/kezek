import { BizAccessError } from './authDiagnostics';
import { logWarn } from './log';
import { createSupabaseAdminClient, createSupabaseServerClient } from './supabaseHelpers';

/**
 * Резолвит контекст сотрудника и при необходимости синхронизирует роль staff.
 * Логика вынесена из getStaffContext (authBiz.ts).
 */
export async function resolveStaffContext() {
    const supabase = await createSupabaseServerClient();

    const {
        data: userData,
        error: eUser,
    } = await supabase.auth.getUser();
    if (eUser || !userData?.user) {
        throw new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED');
    }
    const userId = userData.user.id;

    const { data: staff } = await supabase
        .from('staff')
        .select('id, biz_id, branch_id, full_name, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

    if (!staff) {
        throw new BizAccessError('NO_STAFF_RECORD');
    }

    const bizId = String(staff.biz_id);

    const serviceClient = createSupabaseAdminClient();

    const { data: roleStaff } = await serviceClient
        .from('roles')
        .select('id')
        .eq('key', 'staff')
        .maybeSingle();

    if (roleStaff?.id) {
        const { data: existsRole } = await serviceClient
            .from('user_roles')
            .select('id')
            .eq('user_id', userId)
            .eq('role_id', roleStaff.id)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (!existsRole) {
            const { error: eRole } = await serviceClient
                .from('user_roles')
                .insert({
                    user_id: userId,
                    biz_id: bizId,
                    role_id: roleStaff.id,
                    biz_key: bizId,
                });

            if (eRole) {
                logWarn('AuthBiz', 'Failed to auto-add staff role', { message: eRole.message });
            }
        }
    }

    return { supabase, userId, staffId: staff.id, bizId, branchId: staff.branch_id };
}

