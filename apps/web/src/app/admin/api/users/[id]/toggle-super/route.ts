import { z } from 'zod';

import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getRouteParam } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const inputSchema = z.object({ makeSuper: z.boolean() }).strict();
const idSchema = z.string().uuid();

export async function POST(req: Request, context: unknown) {
    return withErrorHandler('SetPlatformAdmin', async () => {
        const access = await requireCurrentSuperAdmin();
        if (!access.ok) return access.response;
        const id = idSchema.safeParse(await getRouteParam(context, 'id'));
        const body = inputSchema.safeParse(await req.json().catch(() => null));
        if (!id.success || !body.success) return createErrorResponse('validation', 'Некорректный пользователь или makeSuper', undefined, 400);
        const { data, error } = await getServiceClient().rpc('set_platform_admin_role', {
            p_actor_id: access.user.id, p_target_user_id: id.data, p_enabled: body.data.makeSuper,
        });
        if (error) {
            if (error.message === 'PLATFORM_ADMIN_FORBIDDEN') return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
            if (error.message === 'PLATFORM_ADMIN_TARGET_NOT_FOUND') return createErrorResponse('not_found', 'Пользователь не найден', undefined, 404);
            if (error.message === 'PLATFORM_ADMIN_LAST_ADMIN') return createErrorResponse('conflict', 'Нельзя снять роль последнего администратора платформы', undefined, 409);
            return createErrorResponse('service_unavailable', 'Не удалось подтвердить изменение роли', undefined, 503);
        }
        if (typeof data !== 'boolean' || data !== body.data.makeSuper) return createErrorResponse('service_unavailable', 'Состояние роли не подтверждено', undefined, 503);
        return createSuccessResponse({ isSuperAdmin: data });
    });
}
