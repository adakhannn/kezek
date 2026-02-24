import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey } from './env';
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
        currentBizId?: string | null;
        hasCurrentBizRecord?: boolean;
        currentBizHasAllowedRole?: boolean;
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
 * Новый порядок определения:
 * 1) super_admin → current_biz_id (таблица user_current_business), без автоподбора чужих бизнесов
 * 2) current_biz_id (таблица user_current_business) с проверкой прав
 * 3) роли user_roles (owner|admin|manager) с детерминированным выбором
 * 4) Фоллбек: businesses.owner_id = user.id
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

    // Создаем service client для обхода RLS при проверке доступа к бизнесу
    // Это необходимо, так как RLS политики могут блокировать доступ к user_roles и businesses
    const serviceClient = createClient(
        getSupabaseUrl(),
        getSupabaseServiceRoleKey(),
        { auth: { persistSession: false } }
    );

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
        currentBizId?: string | null;
        hasCurrentBizRecord?: boolean;
        currentBizHasAllowedRole?: boolean;
        errors?: Array<{ step: string; error: string }>;
    } = {
        checkedSuperAdmin: isSuper,
        checkedUserRoles: false,
        checkedOwnerId: false,
    };

    if (isSuper) {
        logDebug('AuthBiz', 'Processing super admin business selection', { userId });

        // 2a) super admin: пробуем использовать current_biz_id, если он задан и бизнес существует
        const currentBizStart = Date.now();
        try {
            const { data: current } = await serviceClient
                .from('user_current_business')
                .select('biz_id')
                .eq('user_id', userId)
                .maybeSingle<{ biz_id: string }>();

            if (current?.biz_id) {
                const currentBizId = String(current.biz_id);
                diagnostics.hasCurrentBizRecord = true;
                diagnostics.currentBizId = currentBizId;

                const { data: bizRow, error: bizError } = await serviceClient
                    .from('businesses')
                    .select('id, slug, name')
                    .eq('id', currentBizId)
                    .maybeSingle<{ id: string; slug: string | null; name: string | null }>();

                if (bizError) {
                    logWarn('AuthBiz', 'Super admin current business lookup failed', {
                        userId,
                        currentBizId,
                        error: bizError.message,
                        errorCode: bizError.code,
                        checkTimeMs: Date.now() - currentBizStart,
                    });
                } else if (bizRow?.id) {
                    bizId = bizRow.id;
                    logDebug('AuthBiz', 'Using current business for super admin', {
                        userId,
                        bizId,
                        bizSlug: bizRow.slug,
                        bizName: bizRow.name,
                        resolutionMethod: 'super_admin_current_biz',
                        checkTimeMs: Date.now() - currentBizStart,
                    });
                } else {
                    logWarn('AuthBiz', 'Super admin current business not found in businesses table', {
                        userId,
                        currentBizId,
                        checkTimeMs: Date.now() - currentBizStart,
                    });
                }
            }
        } catch (e) {
            logWarn('AuthBiz', 'Super admin current business resolution failed, fallback to Kezek slug', {
                userId,
                error: e instanceof Error ? e.message : String(e),
                errorType: e instanceof Error ? e.constructor.name : typeof e,
                checkTimeMs: Date.now() - currentBizStart,
            });
        }

        // 2b) Если current_biz_id не подошёл — пробуем Kezek по slug. Больше бизнесы автоматически не выбираем.
        if (!bizId) {
            const kezekCheckStart = Date.now();
            const { data: bizKezek, error: kezekError } = await serviceClient
                .from('businesses')
                .select('id, slug, name')
                .eq('slug', 'kezek')
                .maybeSingle();

            if (kezekError) {
                logError('AuthBiz', 'Error loading Kezek business for super admin', {
                    error: kezekError.message,
                    errorCode: kezekError.code,
                    errorDetails: kezekError.details,
                    userId,
                });
                diagnostics.errors = diagnostics.errors || [];
                diagnostics.errors.push({ step: 'load_kezek_business', error: kezekError.message });
            }

            if (bizKezek?.id) {
                bizId = bizKezek.id;
                logDebug('AuthBiz', 'Using Kezek business for super admin', {
                    bizId,
                    bizName: bizKezek.name,
                    checkTimeMs: Date.now() - kezekCheckStart,
                });
            } else {
                logWarn('AuthBiz', 'Super admin has no current business and Kezek business not found', {
                    userId,
                    totalCheckTimeMs: Date.now() - kezekCheckStart,
                });
            }
        }
    } else {
        logDebug('AuthBiz', 'Processing regular user business selection', { userId });

        // (a) сначала пытаемся использовать current_biz_id из user_current_business
        const currentBizStart = Date.now();
        try {
            const { data: current } = await serviceClient
                .from('user_current_business')
                .select('biz_id')
                .eq('user_id', userId)
                .maybeSingle<{ biz_id: string }>();

            if (current?.biz_id) {
                const currentBizId = String(current.biz_id);
                diagnostics.hasCurrentBizRecord = true;
                diagnostics.currentBizId = currentBizId;
                logDebug('AuthBiz', 'Found current business for user', {
                    userId,
                    currentBizId,
                });

                // Проверяем, что у пользователя есть допустимая роль в этом бизнесе
                const [{ data: ur }, { data: roleRows }] = await Promise.all([
                    serviceClient
                        .from('user_roles')
                        .select('biz_id, role_id')
                        .eq('user_id', userId)
                        .eq('biz_id', currentBizId),
                    serviceClient
                        .from('roles')
                        .select('id, key'),
                ]);

                if (ur && roleRows && ur.length > 0) {
                    const rolesMap = new Map<string, string>(
                        roleRows.map((r: { id: string | number; key: string }) => [String(r.id), String(r.key)])
                    );
                    const hasAllowedRole = ur.some((r: { role_id: string | number }) => {
                        const key = rolesMap.get(String(r.role_id));
                        return !!key && ROLE_KEYS_ALLOWED.has(key);
                    });

                    if (hasAllowedRole) {
                        bizId = currentBizId;
                        diagnostics.currentBizHasAllowedRole = true;
                        logDebug('AuthBiz', 'Using current business for user (validated by roles)', {
                            userId,
                            bizId,
                            resolutionMethod: 'current_biz',
                            checkTimeMs: Date.now() - currentBizStart,
                        });
                    } else {
                        diagnostics.currentBizHasAllowedRole = false;
                        logWarn('AuthBiz', 'Current business has no allowed roles for user, fallback to auto selection', {
                            userId,
                            currentBizId,
                            checkTimeMs: Date.now() - currentBizStart,
                        });
                    }
                } else {
                    diagnostics.currentBizHasAllowedRole = false;
                    logWarn('AuthBiz', 'No user_roles found for current business, fallback to auto selection', {
                        userId,
                        currentBizId,
                        checkTimeMs: Date.now() - currentBizStart,
                    });
                }
            } else {
                logDebug('AuthBiz', 'No current business set for user, will auto select', {
                    userId,
                    checkTimeMs: Date.now() - currentBizStart,
                });
            }
        } catch (e) {
            logWarn('AuthBiz', 'Failed to resolve current business, fallback to auto selection', {
                userId,
                error: e instanceof Error ? e.message : String(e),
                errorType: e instanceof Error ? e.constructor.name : typeof e,
                checkTimeMs: Date.now() - currentBizStart,
            });
        }

        // (b) если current_biz_id не подошёл — ищем по user_roles, но без JOIN, затем мапим role_id -> key
        // Используем service client для обхода RLS при проверке доступа
        const userRolesCheckStart = Date.now();
        const [{ data: ur, error: urError }, { data: roleRows, error: rolesError }] = await Promise.all([
            serviceClient.from('user_roles').select('biz_id, role_id').eq('user_id', userId),
            serviceClient.from('roles').select('id, key'),
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

            // Ищем подходящие роли по ключу
            const eligibleRoles = ur.filter((r: { role_id: string | number; biz_id?: string | null }) => {
                const roleKey = rolesMap.get(String(r.role_id)) || '';
                return ROLE_KEYS_ALLOWED.has(roleKey);
            });
            
            diagnostics.eligibleRolesCount = eligibleRoles.length;

            if (!bizId && eligibleRoles.length > 0) {
                // Приоритет: роли с конкретным biz_id, с детерминированным выбором по biz_id
                const eligibleWithBizId = eligibleRoles
                    .filter((r: { biz_id?: string | null }) => r.biz_id != null)
                    .sort((a: { biz_id?: string | null }, b: { biz_id?: string | null }) => {
                        const aId = String(a.biz_id);
                        const bId = String(b.biz_id);
                        return aId.localeCompare(bId);
                    });

                const selectedRole = eligibleWithBizId[0] ?? null;

                if (selectedRole?.biz_id) {
                    bizId = String(selectedRole.biz_id);
                    const roleKey = rolesMap.get(String(selectedRole.role_id)) || 'unknown';
                    logDebug('AuthBiz', 'Business found via user_roles (with biz_id, deterministic)', { 
                        bizId, 
                        roleKey,
                        eligibleRolesCount: diagnostics.eligibleRolesCount,
                        checkTimeMs: userRolesCheckTime
                    });
                } else {
                    // Если есть только глобальные роли (biz_id = null), ищем бизнес через owner_id как fallback
                    logDebug('AuthBiz', 'Found eligible roles but only global (no biz_id), will check owner_id', { 
                        userId,
                        eligibleRolesCount: eligibleRoles.length,
                        eligibleRoleKeys: eligibleRoles.map((r: { role_id: string | number }) => 
                            rolesMap.get(String(r.role_id)) || 'unknown'
                        ),
                        checkTimeMs: userRolesCheckTime
                    });
                }
            } else if (!bizId) {
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

        // (b) если ролей нет или нет конкретного biz_id — фоллбек по полю owner_id
        if (!bizId) {
            logDebug('AuthBiz', 'No business found via user_roles, checking owner_id', { userId });
            diagnostics.checkedOwnerId = true;
            const ownerCheckStart = Date.now();
            // Используем service client для обхода RLS
            const { data: owned, error: ownedError } = await serviceClient
                .from('businesses')
                .select('id, slug, name')
                .eq('owner_id', userId)
                .order('id', { ascending: true })
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
                // Используем service client для обхода RLS
                const { count, error: countError } = await serviceClient
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
            currentBizId: diagnostics.currentBizId ?? null,
            hasCurrentBizRecord: diagnostics.hasCurrentBizRecord ?? false,
            currentBizHasAllowedRole: diagnostics.currentBizHasAllowedRole ?? false,
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

