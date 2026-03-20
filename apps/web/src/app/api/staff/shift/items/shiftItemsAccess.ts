import { getBizContextForManagers, getStaffContext } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getServiceClient } from '@/lib/supabaseService';

import type { ShiftItemsWorkflowMeta, ShiftItemsWorkflowSuccess, WorkflowError } from './shiftItemsTypes';

type ResolveAccessResult =
    | { ok: true; data: Omit<ShiftItemsWorkflowSuccess, 'percentMaster' | 'percentSalon' | 'shiftId'> }
    | { ok: false; error: WorkflowError; meta?: ShiftItemsWorkflowMeta };

function hasManagerPermission(roles: unknown) {
    return (Array.isArray(roles) ? roles : []).some((role) => {
        if (!role || typeof role !== 'object' || !('roles' in role)) return false;
        const roleObject = (role as { roles?: { key?: unknown } | null }).roles;
        if (!roleObject || typeof roleObject !== 'object' || !('key' in roleObject)) return false;
        const key = roleObject.key;
        return typeof key === 'string' && ['owner', 'admin', 'manager'].includes(key);
    });
}

async function resolveManagerAccess(targetStaffId: string): Promise<ResolveAccessResult> {
    const { supabase, bizId, businessTz } = await getBizContextForManagers();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!user) {
        return {
            ok: false,
            error: { type: 'auth', statusCode: 401, message: 'Не авторизован' },
            meta: { bizId, userId },
        };
    }

    const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(key)')
        .eq('user_id', user.id)
        .eq('biz_id', bizId);

    const { data: owned } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .eq('id', bizId)
        .maybeSingle();

    if (!hasManagerPermission(roles) && !owned) {
        return {
            ok: false,
            error: { type: 'forbidden', statusCode: 403, message: 'Доступ запрещен' },
            meta: { bizId, userId },
        };
    }

    const admin = getServiceClient();
    const staffCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
        admin,
        'staff',
        targetStaffId,
        bizId,
        'id, biz_id'
    );

    if (staffCheck.error || !staffCheck.data) {
        return {
            ok: false,
            error: { type: 'forbidden', statusCode: 403, message: 'Сотрудник не принадлежит этому бизнесу' },
            meta: { bizId, staffId: targetStaffId, userId },
        };
    }

    return {
        ok: true,
        data: {
            bizId,
            businessTz,
            staffId: targetStaffId,
            supabase,
            useServiceClient: true,
            userId,
        },
    };
}

async function resolveStaffAccess(): Promise<ResolveAccessResult> {
    const context = await getStaffContext();
    const { data: { user } } = await context.supabase.auth.getUser();

    return {
        ok: true,
        data: {
            bizId: context.bizId,
            businessTz: context.businessTz,
            staffId: context.staffId,
            supabase: context.supabase,
            useServiceClient: false,
            userId: user?.id,
        },
    };
}

export async function resolveShiftItemsAccess(targetStaffId?: string) {
    if (targetStaffId) {
        return resolveManagerAccess(targetStaffId);
    }

    return resolveStaffAccess();
}
