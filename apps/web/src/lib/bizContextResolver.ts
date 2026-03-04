import type { SupabaseClient } from '@supabase/supabase-js';

import { MANAGER_ROLE_KEYS } from './authContext';
import { BizAccessError } from './authDiagnostics';
import { logDebug, logError, logWarn } from './log';
import { createSupabaseAdminClient, createSupabaseServerClient } from './supabaseHelpers';

/** Диагностика процесса выбора бизнеса (для логов и NO_BIZ_ACCESS). */
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

/**
 * Super-admin: текущий бизнес из user_current_business (если есть и существует в businesses),
 * иначе — бизнес с slug 'kezek'.
 */
async function resolveForSuperAdmin(
    admin: SupabaseClient,
    userId: string,
): Promise<string | undefined> {
    const { data: current } = await admin
        .from('user_current_business')
        .select('biz_id')
        .eq('user_id', userId)
        .maybeSingle<{ biz_id: string }>();

    if (current?.biz_id) {
        const currentBizId = String(current.biz_id);
        const { data: bizRow, error: bizError } = await admin
            .from('businesses')
            .select('id, slug, name')
            .eq('id', currentBizId)
            .maybeSingle<{ id: string; slug: string | null; name: string | null }>();

        if (!bizError && bizRow?.id) {
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
        return undefined;
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

/**
 * Обычный пользователь: если есть запись в user_current_business и у пользователя
 * есть допустимая роль (owner/admin/manager) для этого бизнеса — возвращаем этот biz_id.
 */
async function resolveFromCurrentBusiness(
    admin: SupabaseClient,
    userId: string,
    diagnostics: BizContextDiagnostics,
): Promise<string | undefined> {
    const { data: current } = await admin
        .from('user_current_business')
        .select('biz_id')
        .eq('user_id', userId)
        .maybeSingle<{ biz_id: string }>();

    if (!current?.biz_id) {
        logDebug('AuthBiz', 'No current business set for user, will auto select', { userId });
        return undefined;
    }

    const currentBizId = String(current.biz_id);
    diagnostics.hasCurrentBizRecord = true;
    diagnostics.currentBizId = currentBizId;

    const [{ data: ur }, { data: roleRows }] = await Promise.all([
        admin
            .from('user_roles')
            .select('biz_id, role_id')
            .eq('user_id', userId)
            .eq('biz_id', currentBizId),
        admin.from('roles').select('id, key'),
    ]);

    if (!ur?.length || !roleRows?.length) {
        diagnostics.currentBizHasAllowedRole = false;
        logWarn('AuthBiz', 'No user_roles found for current business', { userId, currentBizId });
        return undefined;
    }

    const rolesMap = new Map<string, string>(
        roleRows.map((r: { id: string | number; key: string }) => [String(r.id), String(r.key)]),
    );
    const hasAllowedRole = ur.some((r: { role_id: string | number }) => {
        const key = rolesMap.get(String(r.role_id));
        return !!key && MANAGER_ROLE_KEYS.has(key);
    });

    if (hasAllowedRole) {
        diagnostics.currentBizHasAllowedRole = true;
        logDebug('AuthBiz', 'Using current business for user (validated by roles)', {
            userId,
            bizId: currentBizId,
            resolutionMethod: 'current_biz',
        });
        return currentBizId;
    }

    diagnostics.currentBizHasAllowedRole = false;
    logWarn('AuthBiz', 'Current business has no allowed roles for user, will not auto switch', {
        userId,
        currentBizId,
    });
    return undefined;
}

/**
 * Автовыбор по user_roles: первый бизнес по ролям owner/admin/manager (детерминированно по biz_id).
 */
async function resolveFromUserRoles(
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

    if (urError) {
        logError('AuthBiz', 'Error loading user_roles', { error: urError.message, userId });
        diagnostics.errors = diagnostics.errors || [];
        diagnostics.errors.push({ step: 'load_user_roles', error: urError.message });
    }
    if (rolesError) {
        logError('AuthBiz', 'Error loading roles', { error: rolesError.message });
        diagnostics.errors = diagnostics.errors || [];
        diagnostics.errors.push({ step: 'load_roles', error: rolesError.message });
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

    const eligibleRoles = ur.filter((r: { role_id: string | number; biz_id?: string | null }) => {
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

/**
 * Фоллбек по owner_id: первый бизнес, где owner_id = userId (по id).
 */
async function resolveFromOwnerId(
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
        diagnostics.errors = diagnostics.errors || [];
        diagnostics.errors.push({ step: 'load_owned_businesses', error: ownedError.message });
        return undefined;
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

/**
 * Выбор текущего бизнеса для кабинета менеджмента.
 * Логика перенесена из getBizContextForManagers (authBiz.ts).
 * Использует подфункции: resolveForSuperAdmin, resolveFromCurrentBusiness, resolveFromUserRoles, resolveFromOwnerId.
 * @see docs/BIZ_CONTEXT_RESOLVER_ADR.md — приоритеты выбора и сценарии.
 */
export async function resolveBizContextForManagers() {
    const startTime = Date.now();
    const supabase = await createSupabaseServerClient();

    logDebug('AuthBiz', 'Starting business context resolution');
    const { data: userData, error: eUser } = await supabase.auth.getUser();
    if (eUser || !userData?.user) {
        logError('AuthBiz', 'User authentication failed', {
            error: eUser?.message,
            hasUser: !!userData?.user,
            errorCode: eUser?.code,
            errorStatus: eUser?.status,
        });
        // Типизированный код ошибки + совместимое текстовое сообщение
        throw new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED');
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email;
    logDebug('AuthBiz', 'User authenticated', { userId, email: userEmail });

    // service client для обхода RLS
    const serviceClient = createSupabaseAdminClient();

    // 1) super_admin через RPC
    let isSuper = false;
    const superAdminCheckStart = Date.now();
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
        isSuper = !!isSuperRes;
        const superAdminCheckTime = Date.now() - superAdminCheckStart;
        logDebug(
            'AuthBiz',
            isSuper ? 'User is super admin' : 'User is not super admin',
            {
                userId,
                checkTimeMs: superAdminCheckTime,
            },
        );
    } catch (e) {
        const superAdminCheckTime = Date.now() - superAdminCheckStart;
        logWarn('AuthBiz', 'RPC is_super_admin not available (non-critical)', {
            error: e instanceof Error ? e.message : String(e),
            errorType: e instanceof Error ? e.constructor.name : typeof e,
            userId,
            checkTimeMs: superAdminCheckTime,
        });
        isSuper = false;
    }

    let bizId: string | undefined;
    const diagnostics: BizContextDiagnostics = {
        checkedSuperAdmin: isSuper,
        checkedUserRoles: false,
        checkedOwnerId: false,
    };

    if (isSuper) {
        bizId = await resolveForSuperAdmin(serviceClient, userId);
    } else {
        bizId = await resolveFromCurrentBusiness(serviceClient, userId, diagnostics);
        const shouldAutoSelect = !diagnostics.hasCurrentBizRecord;
        if (!bizId && shouldAutoSelect) {
            bizId = await resolveFromUserRoles(serviceClient, userId, diagnostics);
        }
        if (!bizId && shouldAutoSelect) {
            bizId = await resolveFromOwnerId(serviceClient, userId, diagnostics);
        }
    }

    if (!bizId) {
        const totalTime = Date.now() - startTime;
        const diagnosticsData = {
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
        logError('AuthBiz', 'NO_BIZ_ACCESS: Business not found for user', {
            userId,
            userEmail,
            isSuperAdmin: isSuper,
            diagnostics: {
                ...diagnostics,
                totalResolutionTimeMs: totalTime,
            },
            resolutionSteps: diagnosticsData,
        });
        throw new BizAccessError('NO_BIZ_ACCESS', undefined, diagnosticsData);
    }

    const totalTime = Date.now() - startTime;
    logDebug('AuthBiz', 'Business context resolved successfully', {
        userId,
        userEmail,
        bizId,
        isSuperAdmin: isSuper,
        resolutionTimeMs: totalTime,
        resolutionMethod: isSuper
            ? 'super_admin'
            : diagnostics.checkedUserRoles &&
              diagnostics.eligibleRolesCount &&
              diagnostics.eligibleRolesCount > 0
            ? 'user_roles'
            : 'owner_id',
    });
    return { supabase, userId, bizId };
}

