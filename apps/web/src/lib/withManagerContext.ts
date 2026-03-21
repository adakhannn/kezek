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
import { logWarn } from './log';
import { createSupabaseAdminClient } from './supabaseHelpers';

type SupabaseClientType = Awaited<ReturnType<typeof getBizContextForManagers>>['supabase'];

/** Контекст для handler: клиенты Supabase и идентификаторы. */
export type ManagerContext = {
    /** Server client (cookies, RLS). */
    supabase: SupabaseClientType;
    /** Admin/client без RLS — для запросов с явной фильтрацией по biz_id. При отсутствии ключа совпадает с supabase. */
    admin: SupabaseClientType;
    /** Текущий бизнес (из user_current_business / ролей / owner_id). */
    bizId: string;
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

    try {
        const ctx = await getBizContextForManagers();
        supabase = ctx.supabase;
        userId = ctx.userId;
        bizId = ctx.bizId;
    } catch (e) {
        if (e instanceof BizAccessError) {
            if (e.code === 'NOT_AUTHENTICATED') {
                return createErrorResponse('auth', 'Требуется авторизация', undefined, 401);
            }
            return createErrorResponse('forbidden', 'Нет доступа к кабинету управления', undefined, 403);
        }
        throw e;
    }

    let admin: SupabaseClientType = supabase;
    try {
        admin = createSupabaseAdminClient();
    } catch (e) {
        logWarn(scope, 'SUPABASE_SERVICE_ROLE_KEY not set, using server client (RLS)', {
            error: e instanceof Error ? e.message : String(e),
        });
    }
    const managerCtx: ManagerContext = { supabase, admin, bizId, userId };
    return handler(managerCtx);
}
