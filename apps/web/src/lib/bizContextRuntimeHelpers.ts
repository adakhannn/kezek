import type { SupabaseClient } from '@supabase/supabase-js';

import type { BizAccessDiagnostics } from './authDiagnostics';
import type { BizContextDiagnostics } from './bizContextResolutionStrategies';
import { logDebug, logWarn } from './log';
import { createSupabaseAdminClient } from './supabaseHelpers';

export function createServiceRoleClientWithFallback<TClient extends SupabaseClient>(params: {
    scope: string;
    serverClient: TClient;
    missingKeyMessage: string;
}): TClient {
    const { scope, serverClient, missingKeyMessage } = params;

    try {
        return createSupabaseAdminClient() as TClient;
    } catch (e) {
        logWarn(scope, missingKeyMessage, {
            error: e instanceof Error ? e.message : String(e),
        });
        return serverClient;
    }
}

export async function createBizServiceClient(
    supabase: SupabaseClient,
): Promise<SupabaseClient> {
    return createServiceRoleClientWithFallback({
        scope: 'AuthBiz',
        serverClient: supabase,
        missingKeyMessage: 'SUPABASE_SERVICE_ROLE_KEY not set, falling back to server client (RLS)',
    });
}

export async function checkIsSuperAdmin(params: {
    supabase: SupabaseClient;
    userId: string;
}): Promise<boolean> {
    const { supabase, userId } = params;
    const startedAt = Date.now();

    try {
        logDebug('AuthBiz', 'Checking super admin status via RPC', { userId });
        const { data: isSuperRes, error: rpcError } = await supabase.rpc('is_super_admin');

        if (rpcError) {
            logWarn('AuthBiz', 'RPC is_super_admin error (non-critical)', {
                error: rpcError.message,
                errorCode: rpcError.code,
                errorDetails: rpcError.details,
                userId,
            });
        }

        const isSuper = !!isSuperRes;
        logDebug('AuthBiz', isSuper ? 'User is super admin' : 'User is not super admin', {
            userId,
            checkTimeMs: Date.now() - startedAt,
        });
        return isSuper;
    } catch (e) {
        logWarn('AuthBiz', 'RPC is_super_admin not available (non-critical)', {
            error: e instanceof Error ? e.message : String(e),
            errorType: e instanceof Error ? e.constructor.name : typeof e,
            userId,
            checkTimeMs: Date.now() - startedAt,
        });
        return false;
    }
}

export function buildNoBizAccessDiagnostics(
    diagnostics: BizContextDiagnostics,
): BizAccessDiagnostics {
    return {
        checkedSuperAdmin: diagnostics.checkedSuperAdmin,
        checkedUserRoles: diagnostics.checkedUserRoles,
        checkedOwnerId: diagnostics.checkedOwnerId,
        currentBizId: diagnostics.currentBizId ?? null,
        hasCurrentBizRecord: diagnostics.hasCurrentBizRecord ?? false,
        currentBizHasAllowedRole: diagnostics.currentBizHasAllowedRole ?? false,
        userRolesFound: diagnostics.userRolesCount ?? 0,
        eligibleRolesFound: diagnostics.eligibleRolesCount ?? 0,
        ownedBusinessesFound: diagnostics.ownedBusinessesCount ?? 0,
        errorsCount: diagnostics.errors?.length ?? 0,
    };
}

export function getBizResolutionMethod(params: {
    isSuper: boolean;
    diagnostics: BizContextDiagnostics;
}): 'super_admin' | 'current_biz' | 'user_roles' | 'owner_id' {
    const { isSuper, diagnostics } = params;

    if (isSuper) {
        return 'super_admin';
    }

    if (diagnostics.hasCurrentBizRecord && diagnostics.currentBizHasAllowedRole) {
        return 'current_biz';
    }

    if (diagnostics.checkedUserRoles && (diagnostics.eligibleRolesCount ?? 0) > 0) {
        return 'user_roles';
    }

    return 'owner_id';
}
