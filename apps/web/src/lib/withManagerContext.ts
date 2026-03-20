/**
 * Обёртка для API-обработчиков кабинета менеджера/владельца.
 * Получает контекст (bizId, supabase, admin, userId) через getBizContextForManagers,
 * при отсутствии авторизации/доступа возвращает 401/403.
 *
 * @see docs/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md
 * @see OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md (блок 5.2)
 */

import type { NextResponse } from 'next/server';

import { createErrorResponse } from './apiErrorHandler';
import { getBizContextForManagers } from './authBiz';
import { BizAccessError } from './authDiagnostics';
import { createSupabaseAdminClient } from './supabaseHelpers';

/** Контекст для handler: клиенты Supabase и идентификаторы. */
export type ManagerContext = {
    /** Server client (cookies, RLS). */
    supabase: Awaited<ReturnType<typeof getBizContextForManagers>>['supabase'];
    /** Admin/client без RLS — для запросов с явной фильтрацией по biz_id. */
    admin: ReturnType<typeof createSupabaseAdminClient>;
    /** Текущий бизнес (из user_current_business / ролей / owner_id). */
    bizId: string;
    /** Таймзона текущего бизнеса с fallback на системную. */
    businessTz: string;
    /** ID авторизованного пользователя. */
    userId: string;
};

/**
 * Вызывает getBizContextForManagers(), создаёт admin-клиент и передаёт контекст в handler.
 * При BizAccessError: NOT_AUTHENTICATED → 401, NO_BIZ_ACCESS (и др.) → 403.
 * Остальные ошибки не перехватываются — оборачивайте в withErrorHandler при необходимости.
 *
 * @param req — запрос (для совместимости с сигнатурой route; при необходимости body читайте из req)
 * @param scope — имя для логов
 * @param handler — (ctx) => Promise<NextResponse>
 * @returns Promise<NextResponse>
 */
export async function withManagerContext(
    req: Request,
    scope: string,
    handler: (ctx: ManagerContext) => Promise<NextResponse>
): Promise<NextResponse> {
    let supabase: ManagerContext['supabase'];
    let userId: string;
    let bizId: string;
    let businessTz: string;

    try {
        const ctx = await getBizContextForManagers();
        supabase = ctx.supabase;
        userId = ctx.userId;
        bizId = ctx.bizId;
        businessTz = ctx.businessTz;
    } catch (e) {
        if (e instanceof BizAccessError) {
            if (e.code === 'NOT_AUTHENTICATED') {
                return createErrorResponse('auth', 'Требуется авторизация', undefined, 401);
            }
            return createErrorResponse('forbidden', 'Нет доступа к кабинету управления', undefined, 403);
        }
        throw e;
    }

    const admin = createSupabaseAdminClient();
    const managerCtx: ManagerContext = {
        supabase,
        admin,
        bizId,
        businessTz,
        userId,
    };
    return handler(managerCtx);
}
