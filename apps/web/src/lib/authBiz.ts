import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabaseUrl, getSupabaseAnonKey } from './env';
import { logWarn, logDebug, logError } from './log';

const ROLE_KEYS_ALLOWED = new Set(['owner', 'admin', 'manager']);

/**
 * Кастомный класс ошибки для передачи диагностической информации
 */
export class BizAccessError extends Error {
    public readonly diagnostics?: {
        checkedSuperAdmin?: boolean;
        checkedUserRoles?: boolean;
        checkedOwnerId?: boolean;
        userRolesFound?: number;
        eligibleRolesFound?: number;
        ownedBusinessesFound?: number;
        errorsCount?: number;
    };

    constructor(message: string, diagnostics?: BizAccessError['diagnostics']) {
        super(message);
        this.name = 'BizAccessError';
        this.diagnostics = diagnostics;
    }
}

export async function getSupabaseServer() {
    const url  = getSupabaseUrl();
    const anon = getSupabaseAnonKey();
    
    const cookieStore = await cookies();

    return createServerClient(url, anon, {
        cookies: {
            get: (n: string) => cookieStore.get(n)?.value,
            set: () => {},
            remove: () => {},
        },
    });
}

/**
 * Возвращает { supabase, userId, bizId } для кабинета менеджмента.
 * Порядок определения:
 * 1) super_admin → slug=kezek или любой бизнес
 * 2) роли user_roles (owner|admin|manager)
 * 3) Фоллбек: businesses.owner_id = user.id
 */
export async function getBizContextForManagers() {
    const startTime = Date.now();
    const supabase = await getSupabaseServer();

    // 1) юзер обязателен
    logDebug('AuthBiz', 'Starting business context resolution');
    const { data: userData, error: eUser } = await supabase.auth.getUser();
    if (eUser || !userData?.user) {
        logError('AuthBiz', 'User authentication failed', { 
            error: eUser?.message,
            hasUser: !!userData?.user,
            errorCode: eUser?.code,
            errorStatus: eUser?.status
        });
        const error = new Error('UNAUTHORIZED');
        error.name = 'UnauthorizedError';
        throw error;
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email;
    logDebug('AuthBiz', 'User authenticated', { userId, email: userEmail });

    // 2) super_admin через RPC (быстро и без RLS-заморочек)
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
                userId
            });
        }
        isSuper = !!isSuperRes;
        const superAdminCheckTime = Date.now() - superAdminCheckStart;
        if (isSuper) {
            logDebug('AuthBiz', 'User is super admin', { 
                userId, 
                checkTimeMs: superAdminCheckTime 
            });
        } else {
            logDebug('AuthBiz', 'User is not super admin', { 
                userId, 
                checkTimeMs: superAdminCheckTime 
            });
        }
    } catch (e) {
        // если RPC нет — считаем, что не супер
        const superAdminCheckTime = Date.now() - superAdminCheckStart;
        logWarn('AuthBiz', 'RPC is_super_admin not available (non-critical)', { 
            error: e instanceof Error ? e.message : String(e),
            errorType: e instanceof Error ? e.constructor.name : typeof e,
            userId,
            checkTimeMs: superAdminCheckTime
        });
        isSuper = false;
    }

    // 3) выбрать бизнес
    let bizId: string | undefined;
    const diagnostics: {
        checkedSuperAdmin: boolean;
        checkedUserRoles: boolean;
        checkedOwnerId: boolean;
        userRolesCount?: number;
        eligibleRolesCount?: number;
        ownedBusinessesCount?: number;
        errors?: Array<{ step: string; error: string }>;
    } = {
        checkedSuperAdmin: isSuper,
        checkedUserRoles: false,
        checkedOwnerId: false,
    };

    if (isSuper) {
        logDebug('AuthBiz', 'Processing super admin business selection', { userId });
        // Kezek в приоритете
        const kezekCheckStart = Date.now();
        const { data: bizKezek, error: kezekError } = await supabase
            .from('businesses')
            .select('id, slug, name')
            .eq('slug', 'kezek')
            .maybeSingle();

        if (kezekError) {
            logError('AuthBiz', 'Error loading Kezek business', { 
                error: kezekError.message,
                errorCode: kezekError.code,
                errorDetails: kezekError.details,
                userId
            });
            diagnostics.errors = diagnostics.errors || [];
            diagnostics.errors.push({ step: 'load_kezek_business', error: kezekError.message });
        }

        if (bizKezek?.id) {
            bizId = bizKezek.id;
            logDebug('AuthBiz', 'Using Kezek business for super admin', { 
                bizId, 
                bizName: bizKezek.name,
                checkTimeMs: Date.now() - kezekCheckStart
            });
        } else {
            logDebug('AuthBiz', 'Kezek business not found, trying any business', { 
                kezekCheckTimeMs: Date.now() - kezekCheckStart
            });
            const anyBizCheckStart = Date.now();
            const { data: anyBiz, error: anyBizError } = await supabase
                .from('businesses')
                .select('id, slug, name')
                .limit(1)
                .maybeSingle();

            if (anyBizError) {
                logError('AuthBiz', 'Error loading any business for super admin', { 
                    error: anyBizError.message,
                    errorCode: anyBizError.code,
                    errorDetails: anyBizError.details,
                    userId
                });
                diagnostics.errors = diagnostics.errors || [];
                diagnostics.errors.push({ step: 'load_any_business', error: anyBizError.message });
            }

            if (anyBiz?.id) {
                bizId = anyBiz.id;
                logDebug('AuthBiz', 'Using first available business for super admin', { 
                    bizId,
                    bizSlug: anyBiz.slug,
                    bizName: anyBiz.name,
                    checkTimeMs: Date.now() - anyBizCheckStart
                });
            } else {
                logWarn('AuthBiz', 'Super admin but no businesses found in database', { 
                    userId,
                    totalCheckTimeMs: Date.now() - anyBizCheckStart
                });
            }
        }
    } else {
        logDebug('AuthBiz', 'Processing regular user business selection', { userId });
        // (a) ищем по user_roles, но без JOIN, затем мапим role_id -> key
        const userRolesCheckStart = Date.now();
        const [{ data: ur, error: urError }, { data: roleRows, error: rolesError }] = await Promise.all([
            supabase.from('user_roles').select('biz_id, role_id').eq('user_id', userId),
            supabase.from('roles').select('id, key'),
        ]);

        diagnostics.checkedUserRoles = true;
        const userRolesCheckTime = Date.now() - userRolesCheckStart;

        if (urError) {
            logError('AuthBiz', 'Error loading user_roles', { 
                error: urError.message,
                errorCode: urError.code,
                errorDetails: urError.details,
                userId,
                checkTimeMs: userRolesCheckTime
            });
            diagnostics.errors = diagnostics.errors || [];
            diagnostics.errors.push({ step: 'load_user_roles', error: urError.message });
        }

        if (rolesError) {
            logError('AuthBiz', 'Error loading roles', { 
                error: rolesError.message,
                errorCode: rolesError.code,
                errorDetails: rolesError.details,
                checkTimeMs: userRolesCheckTime
            });
            diagnostics.errors = diagnostics.errors || [];
            diagnostics.errors.push({ step: 'load_roles', error: rolesError.message });
        }

        if (ur && roleRows) {
            diagnostics.userRolesCount = ur.length;
            const rolesMap = new Map<string, string>(roleRows.map((r: { id: string | number; key: string }) => [String(r.id), String(r.key)]));
            
            // Логируем все роли пользователя для диагностики
            const userRoleKeys = ur.map((r: { role_id: string | number; biz_id?: string | null }) => {
                const roleKey = rolesMap.get(String(r.role_id)) || 'unknown';
                return { roleKey, bizId: r.biz_id };
            });
            logDebug('AuthBiz', 'User roles found', { 
                userId, 
                roles: userRoleKeys,
                totalRoles: ur.length,
                availableRoleKeys: Array.from(rolesMap.values()),
                checkTimeMs: userRolesCheckTime
            });

            const eligible = ur.find((r: { role_id: string | number; biz_id?: string | null }) => {
                const roleKey = rolesMap.get(String(r.role_id)) || '';
                return ROLE_KEYS_ALLOWED.has(roleKey);
            });
            
            if (eligible) {
                diagnostics.eligibleRolesCount = ur.filter((r: { role_id: string | number; biz_id?: string | null }) => {
                    const roleKey = rolesMap.get(String(r.role_id)) || '';
                    return ROLE_KEYS_ALLOWED.has(roleKey);
                }).length;
            }

            if (eligible?.biz_id) {
                bizId = String(eligible.biz_id);
                const roleKey = rolesMap.get(String(eligible.role_id)) || 'unknown';
                logDebug('AuthBiz', 'Business found via user_roles', { 
                    bizId, 
                    roleKey,
                    eligibleRolesCount: diagnostics.eligibleRolesCount,
                    checkTimeMs: userRolesCheckTime
                });
            } else {
                logDebug('AuthBiz', 'No eligible roles found in user_roles', { 
                    userId,
                    userRolesCount: ur.length,
                    userRoleKeys: userRoleKeys.map(r => r.roleKey),
                    allowedRoles: Array.from(ROLE_KEYS_ALLOWED),
                    checkTimeMs: userRolesCheckTime
                });
            }
        } else {
            logDebug('AuthBiz', 'No user_roles or roles data', { 
                userId,
                hasUserRoles: !!ur, 
                hasRoleRows: !!roleRows,
                userRolesCount: ur?.length,
                rolesCount: roleRows?.length,
                checkTimeMs: userRolesCheckTime
            });
        }

        // (b) если ролей нет — фоллбек по полю owner_id
        if (!bizId) {
            logDebug('AuthBiz', 'No business found via user_roles, checking owner_id', { userId });
            diagnostics.checkedOwnerId = true;
            const ownerCheckStart = Date.now();
            const { data: owned, error: ownedError } = await supabase
                .from('businesses')
                .select('id, slug, name')
                .eq('owner_id', userId)
                .limit(1)
                .maybeSingle();

            if (ownedError) {
                logError('AuthBiz', 'Error loading owned businesses', { 
                    error: ownedError.message,
                    errorCode: ownedError.code,
                    errorDetails: ownedError.details,
                    userId,
                    checkTimeMs: Date.now() - ownerCheckStart
                });
                diagnostics.errors = diagnostics.errors || [];
                diagnostics.errors.push({ step: 'load_owned_businesses', error: ownedError.message });
            }

            if (owned?.id) {
                bizId = owned.id;
                logDebug('AuthBiz', 'Business found via owner_id', { 
                    bizId,
                    bizSlug: owned.slug,
                    bizName: owned.name,
                    checkTimeMs: Date.now() - ownerCheckStart
                });
            } else {
                // Проверяем, сколько бизнесов пользователь владеет (для диагностики)
                const countCheckStart = Date.now();
                const { count, error: countError } = await supabase
                    .from('businesses')
                    .select('*', { count: 'exact', head: true })
                    .eq('owner_id', userId);
                
                if (!countError && count !== null) {
                    diagnostics.ownedBusinessesCount = count;
                } else {
                    logWarn('AuthBiz', 'Could not count owned businesses', { 
                        error: countError?.message,
                        errorCode: countError?.code,
                        userId,
                        checkTimeMs: Date.now() - countCheckStart
                    });
                }
                logDebug('AuthBiz', 'No business found via owner_id', { 
                    userId, 
                    ownedBusinessesCount: diagnostics.ownedBusinessesCount,
                    totalCheckTimeMs: Date.now() - ownerCheckStart
                });
            }
        }
    }

    if (!bizId) {
        const totalTime = Date.now() - startTime;
        const diagnosticsData = {
            checkedSuperAdmin: diagnostics.checkedSuperAdmin,
            checkedUserRoles: diagnostics.checkedUserRoles,
            checkedOwnerId: diagnostics.checkedOwnerId,
            userRolesFound: diagnostics.userRolesCount ?? 0,
            eligibleRolesFound: diagnostics.eligibleRolesCount ?? 0,
            ownedBusinessesFound: diagnostics.ownedBusinessesCount ?? 0,
            errorsCount: diagnostics.errors?.length ?? 0
        };
        logError('AuthBiz', 'NO_BIZ_ACCESS: Business not found for user', {
            userId,
            userEmail,
            isSuperAdmin: isSuper,
            diagnostics: {
                ...diagnostics,
                totalResolutionTimeMs: totalTime
            },
            resolutionSteps: diagnosticsData
        });
        throw new BizAccessError('NO_BIZ_ACCESS', diagnosticsData);
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
            : (diagnostics.checkedUserRoles && diagnostics.eligibleRolesCount && diagnostics.eligibleRolesCount > 0)
                ? 'user_roles'
                : 'owner_id'
    });
    return { supabase, userId, bizId };
}

/**
 * Возвращает { supabase, userId, staffId, bizId } для кабинета сотрудника.
 * Проверяет наличие записи в staff с user_id, автоматически добавляет роль если её нет.
 */
export async function getStaffContext() {
    const supabase = await getSupabaseServer();

    // 1) юзер обязателен
    const { data: userData, error: eUser } = await supabase.auth.getUser();
    if (eUser || !userData?.user) throw new Error('UNAUTHORIZED');
    const userId = userData.user.id;

    // 2) Ищем запись в staff по user_id (это источник правды)
    const { data: staff } = await supabase
        .from('staff')
        .select('id, biz_id, branch_id, full_name, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

    if (!staff) throw new Error('NO_STAFF_RECORD');
    
    const bizId = String(staff.biz_id);

    // 3) Проверяем и автоматически добавляем роль staff в user_roles, если её нет
    const { createClient } = await import('@supabase/supabase-js');
    const { getSupabaseUrl, getSupabaseServiceRoleKey } = await import('./env');
    const serviceClient = createClient(
        getSupabaseUrl(),
        getSupabaseServiceRoleKey(),
        { auth: { persistSession: false } }
    );

    // Получаем ID роли staff
    const { data: roleStaff } = await serviceClient
        .from('roles')
        .select('id')
        .eq('key', 'staff')
        .maybeSingle();

    if (roleStaff?.id) {
        // Проверяем, есть ли уже роль
        const { data: existsRole } = await serviceClient
            .from('user_roles')
            .select('id')
            .eq('user_id', userId)
            .eq('role_id', roleStaff.id)
            .eq('biz_id', bizId)
            .maybeSingle();

        // Если роли нет - добавляем автоматически
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
                // Не бросаем ошибку, т.к. запись staff есть - это главное
            }
        }
    }

    return { supabase, userId, staffId: staff.id, bizId, branchId: staff.branch_id };
}

