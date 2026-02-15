export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse, ApiSuccessResponse } from '@/lib/apiErrorHandler';
import {getBizContextForManagers} from '@/lib/authBiz';
import {getServiceClient} from '@/lib/supabaseService';

/**
 * Синхронизирует роли staff для всех сотрудников бизнеса, у которых есть user_id, но нет роли staff
 */
export async function POST(req: Request) {
    return withErrorHandler<ApiSuccessResponse<{ synced: number; message: string } | { synced: number; total: number; errors: string[] | undefined }>>('StaffSyncRoles', async () => {
        const {supabase, bizId} = await getBizContextForManagers();

        // Проверяем доступ (только владельцы, админы, менеджеры)
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) return createErrorResponse('auth', 'Не авторизован', undefined, 401);

        const {data: roles} = await supabase
            .from('user_roles')
            .select('roles!inner(key)')
            .eq('user_id', user.id)
            .eq('biz_id', bizId);

        const ok = (roles ?? []).some(r => {
            if (!r || typeof r !== 'object' || !('roles' in r)) return false;
            const roleObj = (r as { roles?: { key?: unknown } | null }).roles;
            if (!roleObj || typeof roleObj !== 'object' || !('key' in roleObj)) return false;
            const key = roleObj.key;
            return typeof key === 'string' && ['owner', 'admin', 'manager'].includes(key);
        });
        if (!ok) return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);

        const admin = getServiceClient();

        // Получаем ID роли staff
        const { data: roleStaff } = await admin
            .from('roles')
            .select('id')
            .eq('key', 'staff')
            .maybeSingle();
        
        if (!roleStaff?.id) {
            return createErrorResponse('not_found', 'Роль staff не найдена', undefined, 400);
        }

        // Получаем всех активных сотрудников с user_id
        const { data: staffList, error: staffError } = await admin
            .from('staff')
            .select('id, user_id, full_name')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .not('user_id', 'is', null);

        if (staffError) {
            return createErrorResponse('internal', staffError.message, undefined, 400);
        }

        if (!staffList || staffList.length === 0) {
            return createSuccessResponse({ synced: 0, message: 'No staff with user_id found' });
        }

        // Для каждого сотрудника проверяем и добавляем роль, если её нет
        let synced = 0;
        const errors: string[] = [];

        for (const staff of staffList) {
            if (!staff.user_id) continue;

            // Проверяем, есть ли уже роль
            const { data: existsRole } = await admin
                .from('user_roles')
                .select('id')
                .eq('user_id', staff.user_id)
                .eq('role_id', roleStaff.id)
                .eq('biz_id', bizId)
                .maybeSingle();

            if (!existsRole) {
                // Добавляем роль
                const { error: eRole } = await admin
                    .from('user_roles')
                    .insert({
                        user_id: staff.user_id,
                        biz_id: bizId,
                        role_id: roleStaff.id,
                        biz_key: bizId,
                    });
                
                if (eRole) {
                    errors.push(`${staff.full_name}: ${eRole.message}`);
                } else {
                    synced++;
                }
            }
        }

        return createSuccessResponse({
            synced,
            total: staffList.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    });
}

