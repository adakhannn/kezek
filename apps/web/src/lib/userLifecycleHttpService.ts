import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
import { getRouteParam } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

const uuid = z.string().uuid();
const suspendInput = z.object({ block: z.boolean(), reason: z.string().max(500).optional() }).strict();
const receiptSchema = z.object({ commandId: uuid, completed: z.boolean(), action: z.enum(['block', 'unblock', 'delete']) });
type Action = z.infer<typeof receiptSchema>['action'];
const failure = (status: number, code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status });
const unavailable = () => failure(503, 'USER_LIFECYCLE_UNCONFIRMED', 'Результат пока не подтверждён. Повторите то же действие.');

function commandError(message: string) {
    switch (message) {
        case 'USER_LIFECYCLE_FORBIDDEN': return failure(403, message, 'Доступ запрещён');
        case 'USER_LIFECYCLE_SELF': return failure(400, message, 'Нельзя изменить собственный аккаунт этим действием');
        case 'USER_LIFECYCLE_NOT_FOUND': return failure(404, message, 'Пользователь не найден');
        case 'USER_LIFECYCLE_PROTECTED': return failure(409, message, 'Сначала снимите роль администратора платформы');
        case 'USER_LIFECYCLE_OWNER': return failure(409, message, 'Сначала передайте владение бизнесами другому пользователю');
        case 'USER_LIFECYCLE_PENDING': return failure(409, message, 'Предыдущее действие не завершено. Повторите его перед новым действием.');
        default: return unavailable();
    }
}

/** Auth is the identity writer. A DB trigger commits the receipt and dependent
 * changes in its transaction; a timeout is never interpreted as success/failure. */
export async function runUserLifecycleHttp(req: Request, context: unknown, operation: 'suspend' | 'delete') {
    const access = await requireCurrentSuperAdmin();
    if (!access.ok) return access.response;
    const id = uuid.safeParse(await getRouteParam(context, 'id'));
    if (!id.success) return failure(400, 'USER_LIFECYCLE_INVALID_INPUT', 'Некорректный ID пользователя');
    let action: Action = 'delete';
    let reason: string | null = null;
    if (operation === 'suspend') {
        const body = suspendInput.safeParse(await req.json().catch(() => null));
        if (!body.success) return failure(400, 'USER_LIFECYCLE_INVALID_INPUT', 'Требуется block: boolean; reason — строка до 500 символов');
        action = body.data.block ? 'block' : 'unblock';
        reason = body.data.reason ?? null;
    }
    try {
        const service = getServiceClient();
        const { data, error } = await service.rpc('prepare_user_lifecycle', {
            p_actor_id: access.user.id, p_user_id: id.data, p_action: action, p_reason: reason,
        });
        if (error) return commandError(error.message);
        const parsed = receiptSchema.safeParse(data);
        if (!parsed.success || parsed.data.action !== action) return unavailable();
        if (!parsed.data.completed) {
            // Do not guess the outcome from an Auth error or a dropped response.
            // Read the durable receipt even if Auth throws after committing.
            try {
                if (action === 'delete') await service.auth.admin.deleteUser(id.data);
                else await service.auth.admin.updateUserById(id.data, {
                    ban_duration: action === 'block' ? '876000h' : 'none',
                    app_metadata: { kezek_lifecycle_command: parsed.data.commandId },
                });
            } catch { /* The authoritative receipt below resolves ambiguous delivery. */ }
            const confirmed = await service.rpc('read_user_lifecycle', {
                p_actor_id: access.user.id, p_user_id: id.data, p_command_id: parsed.data.commandId,
            });
            if (confirmed.error || confirmed.data !== true) return unavailable();
        }
        return NextResponse.json(action === 'delete' ? { ok: true } : { ok: true, blocked: action === 'block' });
    } catch {
        return unavailable();
    }
}
