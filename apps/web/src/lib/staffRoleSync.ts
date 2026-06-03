import { BizAccessError } from './authDiagnostics';
import { createServiceRoleClientWithFallback } from './bizContextRuntimeHelpers';
import { logWarn } from './log';
import { resolveRequestAuthContext } from './requestAuthContext';
import { createSupabaseServerClient } from './supabaseHelpers';

type StaffRecord = {
    id: string;
    biz_id: string;
    branch_id: string | null;
    full_name?: string | null;
    is_active?: boolean;
};

export type StaffContext = {
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    userId: string;
    staffId: string;
    bizId: string;
    branchId: string | null;
};

async function loadActiveStaffRecord(params: {
    supabase: StaffContext['supabase'];
    userId: string;
}): Promise<StaffRecord | null> {
    const { supabase, userId } = params;

    const { data: staff } = await supabase
        .from('staff')
        .select('id, biz_id, branch_id, full_name, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle<StaffRecord>();

    return staff ?? null;
}

async function ensureStaffRoleAssignment(params: {
    serviceClient: StaffContext['supabase'];
    userId: string;
    bizId: string;
}) {
    const { serviceClient, userId, bizId } = params;

    const { data: roleStaff } = await serviceClient
        .from('roles')
        .select('id')
        .eq('key', 'staff')
        .maybeSingle<{ id: string }>();

    if (!roleStaff?.id) {
        return;
    }

    const { data: existingRole } = await serviceClient
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', roleStaff.id)
        .eq('biz_id', bizId)
        .maybeSingle<{ id: string }>();

    if (existingRole) {
        return;
    }

    const { error } = await serviceClient
        .from('user_roles')
        .insert({
            user_id: userId,
            biz_id: bizId,
            role_id: roleStaff.id,
            biz_key: bizId,
        });

    if (error) {
        logWarn('AuthBiz', 'Failed to auto-add staff role', { message: error.message });
    }
}

export async function resolveStaffContext(): Promise<StaffContext> {
    const supabase = await createSupabaseServerClient();

    const {
        data: userData,
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
        throw new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED');
    }

    const userId = userData.user.id;
    const staff = await loadActiveStaffRecord({ supabase, userId });

    if (!staff) {
        throw new BizAccessError('NO_STAFF_RECORD');
    }

    const bizId = String(staff.biz_id);
    const serviceClient = createServiceRoleClientWithFallback({
        scope: 'AuthBiz',
        serverClient: supabase,
        missingKeyMessage: 'SUPABASE_SERVICE_ROLE_KEY not set, using server client (RLS)',
    });

    await ensureStaffRoleAssignment({
        serviceClient,
        userId,
        bizId,
    });

    return {
        supabase,
        userId,
        staffId: staff.id,
        bizId,
        branchId: staff.branch_id ?? null,
    };
}

export async function resolveStaffContextForRequest(req: Request, scope = 'AuthBiz'): Promise<StaffContext> {
    const authContext = await resolveRequestAuthContext(req, scope);

    if (!('user' in authContext)) {
        throw new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED');
    }

    const { supabase, user } = authContext;
    const userId = user.id;
    const staff = await loadActiveStaffRecord({ supabase, userId });

    if (!staff) {
        throw new BizAccessError('NO_STAFF_RECORD');
    }

    const bizId = String(staff.biz_id);
    const serviceClient = createServiceRoleClientWithFallback({
        scope,
        serverClient: supabase,
        missingKeyMessage: 'SUPABASE_SERVICE_ROLE_KEY not set, using request client (RLS)',
    });

    await ensureStaffRoleAssignment({
        serviceClient,
        userId,
        bizId,
    });

    return {
        supabase,
        userId,
        staffId: staff.id,
        bizId,
        branchId: staff.branch_id ?? null,
    };
}
