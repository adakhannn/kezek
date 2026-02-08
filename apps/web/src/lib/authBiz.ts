import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabaseUrl, getSupabaseAnonKey } from './env';
import { logWarn, logDebug, logError } from './log';

const ROLE_KEYS_ALLOWED = new Set(['owner', 'admin', 'manager']);

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
    const supabase = await getSupabaseServer();

    // 1) юзер обязателен
    const { data: userData, error: eUser } = await supabase.auth.getUser();
    if (eUser || !userData?.user) {
        logError('AuthBiz', 'User authentication failed', { 
            error: eUser?.message,
            hasUser: !!userData?.user 
        });
        throw new Error('UNAUTHORIZED');
    }
    const userId = userData.user.id;
    logDebug('AuthBiz', 'User authenticated', { userId });

    // 2) super_admin через RPC (быстро и без RLS-заморочек)
    let isSuper = false;
    try {
        const { data: isSuperRes, error: rpcError } = await supabase.rpc('is_super_admin');
        if (rpcError) {
            logDebug('AuthBiz', 'RPC is_super_admin error (non-critical)', { error: rpcError.message });
        }
        isSuper = !!isSuperRes;
        if (isSuper) {
            logDebug('AuthBiz', 'User is super admin');
        }
    } catch (e) {
        // если RPC нет — считаем, что не супер
        logDebug('AuthBiz', 'RPC is_super_admin not available (non-critical)', { error: e instanceof Error ? e.message : String(e) });
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
        // Kezek в приоритете
        const { data: bizKezek, error: kezekError } = await supabase
            .from('businesses')
            .select('id')
            .eq('slug', 'kezek')
            .maybeSingle();

        if (kezekError) {
            logError('AuthBiz', 'Error loading Kezek business', { error: kezekError.message });
            diagnostics.errors = diagnostics.errors || [];
            diagnostics.errors.push({ step: 'load_kezek_business', error: kezekError.message });
        }

        if (bizKezek?.id) {
            bizId = bizKezek.id;
            logDebug('AuthBiz', 'Using Kezek business for super admin', { bizId });
        } else {
            const { data: anyBiz, error: anyBizError } = await supabase
                .from('businesses')
                .select('id')
                .limit(1)
                .maybeSingle();

            if (anyBizError) {
                logError('AuthBiz', 'Error loading any business for super admin', { error: anyBizError.message });
                diagnostics.errors = diagnostics.errors || [];
                diagnostics.errors.push({ step: 'load_any_business', error: anyBizError.message });
            }

            if (anyBiz?.id) {
                bizId = anyBiz.id;
                logDebug('AuthBiz', 'Using first available business for super admin', { bizId });
            } else {
                logWarn('AuthBiz', 'Super admin but no businesses found in database');
            }
        }
    } else {
        // (a) ищем по user_roles, но без JOIN, затем мапим role_id -> key
        const [{ data: ur, error: urError }, { data: roleRows, error: rolesError }] = await Promise.all([
            supabase.from('user_roles').select('biz_id, role_id').eq('user_id', userId),
            supabase.from('roles').select('id, key'),
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

        if (ur && roleRows) {
            diagnostics.userRolesCount = ur.length;
            const rolesMap = new Map<string, string>(roleRows.map((r: { id: string | number; key: string }) => [String(r.id), String(r.key)]));
            
            // Логируем все роли пользователя для диагностики
            const userRoleKeys = ur.map((r: { role_id: string | number; biz_id?: string | null }) => {
                const roleKey = rolesMap.get(String(r.role_id)) || 'unknown';
                return { roleKey, bizId: r.biz_id };
            });
            logDebug('AuthBiz', 'User roles found', { userId, roles: userRoleKeys });

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
                logDebug('AuthBiz', 'Business found via user_roles', { bizId, roleKey });
            } else {
                logDebug('AuthBiz', 'No eligible roles found in user_roles', { 
                    userRolesCount: ur.length,
                    allowedRoles: Array.from(ROLE_KEYS_ALLOWED)
                });
            }
        } else {
            logDebug('AuthBiz', 'No user_roles or roles data', { 
                hasUserRoles: !!ur, 
                hasRoleRows: !!roleRows 
            });
        }

        // (b) если ролей нет — фоллбек по полю owner_id
        if (!bizId) {
            diagnostics.checkedOwnerId = true;
            const { data: owned, error: ownedError } = await supabase
                .from('businesses')
                .select('id')
                .eq('owner_id', userId)
                .limit(1)
                .maybeSingle();

            if (ownedError) {
                logError('AuthBiz', 'Error loading owned businesses', { error: ownedError.message, userId });
                diagnostics.errors = diagnostics.errors || [];
                diagnostics.errors.push({ step: 'load_owned_businesses', error: ownedError.message });
            }

            if (owned?.id) {
                bizId = owned.id;
                logDebug('AuthBiz', 'Business found via owner_id', { bizId });
            } else {
                // Проверяем, сколько бизнесов пользователь владеет (для диагностики)
                const { count, error: countError } = await supabase
                    .from('businesses')
                    .select('*', { count: 'exact', head: true })
                    .eq('owner_id', userId);
                
                if (!countError && count !== null) {
                    diagnostics.ownedBusinessesCount = count;
                } else {
                    logDebug('AuthBiz', 'Could not count owned businesses', { error: countError?.message });
                }
                logDebug('AuthBiz', 'No business found via owner_id', { userId, ownedBusinessesCount: diagnostics.ownedBusinessesCount });
            }
        }
    }

    if (!bizId) {
        logError('AuthBiz', 'NO_BIZ_ACCESS: Business not found for user', {
            userId,
            isSuperAdmin: isSuper,
            diagnostics
        });
        throw new Error('NO_BIZ_ACCESS');
    }

    logDebug('AuthBiz', 'Business context resolved', { userId, bizId });
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

