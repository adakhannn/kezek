import type { SupabaseClient } from '@supabase/supabase-js';

import { MANAGER_ROLE_KEYS } from './authContext';
import { BizAccessError } from './authDiagnostics';
import { BusinessAccessReadError, managerAccessToBusiness } from './businessManagerAccess';
import { logDebug, logError, logWarn } from './log';

/** Диагностика процесса выбора бизнеса для логов и NO_BIZ_ACCESS. */
export interface BizContextDiagnostics {
    checkedSuperAdmin: boolean;
    checkedUserRoles: boolean;
    checkedOwnerId: boolean;
    userRolesCount?: number;
    eligibleRolesCount?: number;
    ownedBusinessesCount?: number;
    currentBizId?: string | null;
    hasCurrentBizRecord?: boolean;
    currentBizHasAllowedRole?: boolean;
    errors?: Array<{ step: string; error: string }>;
}

export async function resolveForSuperAdmin(
    admin: SupabaseClient,
    userId: string,
): Promise<string | undefined> {
    const { data: current, error: currentError } = await admin
        .from('user_current_business')
        .select('biz_id')
        .eq('user_id', userId)
        .maybeSingle<{ biz_id: string }>();
    if (currentError) {
        logError('AuthBiz', 'Error loading current business', { error: currentError.message, userId });
        throw new BizAccessError('SERVICE_UNAVAILABLE', 'BUSINESS_CONTEXT_UNAVAILABLE');
    }

    if (current?.biz_id) {
        const currentBizId = String(current.biz_id);
        const { data: bizRow, error: bizError } = await admin
            .from('businesses')
            .select('id, slug, name')
            .eq('id', currentBizId)
            .maybeSingle<{ id: string; slug: string | null; name: string | null }>();

        if (bizError) {
            logError('AuthBiz', 'Error loading the current business of a super admin', { error: bizError.message, userId });
            throw new BizAccessError('SERVICE_UNAVAILABLE', 'BUSINESS_CONTEXT_UNAVAILABLE');
        }
        if (bizRow?.id) {
            logDebug('AuthBiz', 'Using current business for super admin', {
                userId,
                bizId: bizRow.id,
                bizSlug: bizRow.slug,
                resolutionMethod: 'super_admin_current_biz',
            });
            return bizRow.id;
        }
        logWarn('AuthBiz', 'Super admin current business not found in businesses table', {
            userId,
            currentBizId,
        });
    }

    const { data: bizKezek, error: kezekError } = await admin
        .from('businesses')
        .select('id, slug, name')
        .eq('slug', 'kezek')
        .maybeSingle();

    if (kezekError) {
        logError('AuthBiz', 'Error loading Kezek business for super admin', {
            error: kezekError.message,
            userId,
        });
        throw new BizAccessError('SERVICE_UNAVAILABLE', 'BUSINESS_CONTEXT_UNAVAILABLE');
    }
    if (bizKezek?.id) {
        logDebug('AuthBiz', 'Using Kezek business for super admin', {
            bizId: bizKezek.id,
            bizName: bizKezek.name,
        });
        return bizKezek.id;
    }
    return undefined;
}

export async function resolveFromCurrentBusiness(
    admin: SupabaseClient,
    userId: string,
    diagnostics: BizContextDiagnostics,
): Promise<string | undefined> {
    const { data: current, error: currentError } = await admin
        .from('user_current_business')
        .select('biz_id')
        .eq('user_id', userId)
        .maybeSingle<{ biz_id: string }>();

    // A failed read is not "no choice": auto-selecting would silently switch the manager to
    // another business (ARCH-06).
    if (currentError) {
        logError('AuthBiz', 'Error loading current business', { error: currentError.message, userId });
        throw new BizAccessError('SERVICE_UNAVAILABLE', 'BUSINESS_CONTEXT_UNAVAILABLE');
    }

    if (!current?.biz_id) {
        logDebug('AuthBiz', 'No current business set for user, will auto select', { userId });
        return undefined;
    }

    const currentBizId = String(current.biz_id);
    diagnostics.hasCurrentBizRecord = true;
    diagnostics.currentBizId = currentBizId;

    // The same rule as selecting it (POST /api/me/current-business): owner or manager role.
    let access: Awaited<ReturnType<typeof managerAccessToBusiness>>;
    try {
        access = await managerAccessToBusiness(admin, userId, currentBizId);
    } catch (error) {
        if (!(error instanceof BusinessAccessReadError)) throw error;
        logError('AuthBiz', 'Error checking access to the current business', { step: error.step, userId, currentBizId });
        throw new BizAccessError('SERVICE_UNAVAILABLE', 'BUSINESS_CONTEXT_UNAVAILABLE');
    }

    if (access === 'manager') {
        diagnostics.currentBizHasAllowedRole = true;
        logDebug('AuthBiz', 'Using current business for user', {
            userId,
            bizId: currentBizId,
            resolutionMethod: 'current_biz',
        });
        return currentBizId;
    }

    diagnostics.currentBizHasAllowedRole = false;
    logWarn('AuthBiz', 'Current business is not managed by the user, will not auto switch', {
        userId,
        currentBizId,
        reason: access,
    });
    return undefined;
}

export async function resolveFromUserRoles(
    admin: SupabaseClient,
    userId: string,
    diagnostics: BizContextDiagnostics,
): Promise<string | undefined> {
    const [{ data: ur, error: urError }, { data: roleRows, error: rolesError }] =
        await Promise.all([
            admin.from('user_roles').select('biz_id, role_id').eq('user_id', userId),
            admin.from('roles').select('id, key'),
        ]);

    diagnostics.checkedUserRoles = true;

    // Falling through to owner_id after a failed read could pick a different business.
    if (urError) {
        logError('AuthBiz', 'Error loading user_roles', { error: urError.message, userId });
        throw new BizAccessError('SERVICE_UNAVAILABLE', 'BUSINESS_CONTEXT_UNAVAILABLE');
    }
    if (rolesError) {
        logError('AuthBiz', 'Error loading roles', { error: rolesError.message });
        throw new BizAccessError('SERVICE_UNAVAILABLE', 'BUSINESS_CONTEXT_UNAVAILABLE');
    }

    if (!ur?.length || !roleRows?.length) {
        logDebug('AuthBiz', 'No user_roles or roles data', {
            userId,
            hasUserRoles: !!ur,
            hasRoleRows: !!roleRows,
        });
        return undefined;
    }

    const rolesMap = new Map<string, string>(
        roleRows.map((r: { id: string | number; key: string }) => [String(r.id), String(r.key)]),
    );
    diagnostics.userRolesCount = ur.length;

    const eligibleRoles = ur.filter((r: { role_id: string | number }) => {
        const roleKey = rolesMap.get(String(r.role_id)) || '';
        return MANAGER_ROLE_KEYS.has(roleKey);
    });
    diagnostics.eligibleRolesCount = eligibleRoles.length;

    const eligibleWithBizId = eligibleRoles
        .filter((r: { biz_id?: string | null }) => r.biz_id != null)
        .sort((a: { biz_id?: string | null }, b: { biz_id?: string | null }) => {
            const aId = String(a.biz_id);
            const bId = String(b.biz_id);
            return aId.localeCompare(bId);
        });

    const selected = eligibleWithBizId[0];
    if (selected?.biz_id) {
        const bizId = String(selected.biz_id);
        logDebug('AuthBiz', 'Business found via user_roles (deterministic)', {
            bizId,
            eligibleRolesCount: eligibleRoles.length,
        });
        return bizId;
    }
    return undefined;
}

export async function resolveFromOwnerId(
    admin: SupabaseClient,
    userId: string,
    diagnostics: BizContextDiagnostics,
): Promise<string | undefined> {
    diagnostics.checkedOwnerId = true;
    logDebug('AuthBiz', 'No business found via user_roles, checking owner_id', { userId });

    const { data: owned, error: ownedError } = await admin
        .from('businesses')
        .select('id, slug, name')
        .eq('owner_id', userId)
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (ownedError) {
        logError('AuthBiz', 'Error loading owned businesses', { error: ownedError.message, userId });
        throw new BizAccessError('SERVICE_UNAVAILABLE', 'BUSINESS_CONTEXT_UNAVAILABLE');
    }

    if (owned?.id) {
        logDebug('AuthBiz', 'Business found via owner_id', {
            bizId: owned.id,
            bizSlug: owned.slug,
            bizName: owned.name,
        });
        return owned.id;
    }

    const { count, error: countError } = await admin
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', userId);
    if (!countError && count !== null) {
        diagnostics.ownedBusinessesCount = count;
    }
    logDebug('AuthBiz', 'No business found via owner_id', {
        userId,
        ownedBusinessesCount: diagnostics.ownedBusinessesCount,
    });
    return undefined;
}
