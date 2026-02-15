// apps/web/src/lib/dbHelpers.ts

/**
 * Утилиты для работы с базой данных
 * Устраняет дублирование паттернов запросов к БД
 */

import { type SupabaseClient } from '@supabase/supabase-js';

import { logError } from './log';

/**
 * Результат операции с БД
 */
export type DbResult<T> = {
    data: T | null;
    error: string | null;
};

/**
 * Выполняет запрос к БД и обрабатывает ошибки
 * Унифицирует обработку ошибок для всех запросов
 */
export async function executeDbQuery<T>(
    query: Promise<{ data: T | null; error: unknown }>,
    context: string
): Promise<DbResult<T>> {
    try {
        const result = await query;
        
        if (result.error) {
            const errorMessage = result.error instanceof Error 
                ? result.error.message 
                : String(result.error);
            
            logError('DbHelpers', `Error in ${context}`, {
                context,
                error: errorMessage,
            });
            
            return {
                data: null,
                error: errorMessage,
            };
        }
        
        return {
            data: result.data,
            error: null,
        };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        logError('DbHelpers', `Unexpected error in ${context}`, {
            context,
            error: errorMessage,
        });
        
        return {
            data: null,
            error: errorMessage,
        };
    }
}

/**
 * Проверяет, принадлежит ли ресурс указанному бизнесу
 * Унифицированная проверка принадлежности ресурса
 */
export async function checkResourceBelongsToBiz<T extends { biz_id: string | number | null }>(
    admin: SupabaseClient,
    table: string,
    resourceId: string,
    bizId: string,
    selectColumns: string = 'id, biz_id'
): Promise<DbResult<T>> {
    const result = await executeDbQuery<T>(
        Promise.resolve(
            admin
                .from(table)
                .select(selectColumns)
                .eq('id', resourceId)
                .maybeSingle()
                .then((r) => ({ data: r.data as T | null, error: r.error }))
        ),
        `checkResourceBelongsToBiz(${table}, ${resourceId})`
    );

    if (result.error) {
        return result;
    }

    if (!result.data) {
        return {
            data: null,
            error: 'Resource not found',
        };
    }

    const resourceBizId = result.data.biz_id;
    if (String(resourceBizId) !== String(bizId)) {
        return {
            data: null,
            error: 'Resource does not belong to this business',
        };
    }

    return result;
}

/**
 * Обновляет ресурс с проверкой принадлежности к бизнесу
 */
export async function updateResourceWithBizCheck<T extends { biz_id: string | number | null }>(
    admin: SupabaseClient,
    table: string,
    resourceId: string,
    bizId: string,
    updateData: Record<string, unknown>,
    selectColumns?: string
): Promise<DbResult<T>> {
    // Сначала проверяем принадлежность
    const checkResult = await checkResourceBelongsToBiz<T>(
        admin,
        table,
        resourceId,
        bizId,
        'id, biz_id'
    );

    if (checkResult.error || !checkResult.data) {
        return checkResult;
    }

    // Выполняем обновление
    const updateResult = await executeDbQuery<T>(
        Promise.resolve(
            admin
                .from(table)
                .update(updateData)
                .eq('id', resourceId)
                .eq('biz_id', bizId)
                .select(selectColumns || '*')
                .maybeSingle()
                .then((r) => ({ data: r.data as T | null, error: r.error }))
        ),
        `updateResourceWithBizCheck(${table}, ${resourceId})`
    );

    return updateResult;
}

/**
 * Удаляет ресурс с проверкой принадлежности к бизнесу
 */
export async function deleteResourceWithBizCheck(
    admin: SupabaseClient,
    table: string,
    resourceId: string,
    bizId: string
): Promise<DbResult<{ id: string }>> {
    // Сначала проверяем принадлежность
    const checkResult = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
        admin,
        table,
        resourceId,
        bizId,
        'id, biz_id'
    );

    if (checkResult.error || !checkResult.data) {
        return {
            data: null,
            error: checkResult.error || 'Resource not found',
        };
    }

    // Выполняем удаление
    const deleteResult = await executeDbQuery<{ id: string }>(
        Promise.resolve(
            admin
                .from(table)
                .delete()
                .eq('id', resourceId)
                .eq('biz_id', bizId)
                .select('id')
                .maybeSingle()
                .then((r) => ({ data: r.data as { id: string } | null, error: r.error }))
        ),
        `deleteResourceWithBizCheck(${table}, ${resourceId})`
    );

    return deleteResult;
}

