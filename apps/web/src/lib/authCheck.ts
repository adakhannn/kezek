/**
 * Утилиты для проверки прав доступа к ресурсам
 * Централизованная проверка принадлежности ресурсов к бизнесу пользователя
 */


import { logError } from './log';
import { getServiceClient } from './supabaseService';

/**
 * Проверяет, принадлежит ли ресурс указанному бизнесу
 * @param table - название таблицы
 * @param resourceId - ID ресурса
 * @param bizId - ID бизнеса
 * @param bizIdColumn - название колонки с ID бизнеса (по умолчанию 'biz_id')
 * @returns true если ресурс принадлежит бизнесу, false иначе
 */
export async function checkResourceBelongsToBusiness(
    table: string,
    resourceId: string,
    bizId: string,
    bizIdColumn: string = 'biz_id'
): Promise<{ belongs: boolean; error?: string }> {
    try {
        const admin = getServiceClient();
        const { data, error } = await admin
            .from(table)
            .select(bizIdColumn)
            .eq('id', resourceId)
            .maybeSingle();

        if (error) {
            logError('AuthCheck', `Error checking ${table}`, { error, resourceId, bizId });
            return { belongs: false, error: error.message };
        }

        if (!data) {
            return { belongs: false, error: 'Resource not found' };
        }

        const resourceBizId = data[bizIdColumn as keyof typeof data];
        const belongs = String(resourceBizId) === String(bizId);
        
        return { belongs };
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        logError('AuthCheck', `Unexpected error checking ${table}`, { error: errorMsg, resourceId, bizId });
        return { belongs: false, error: errorMsg };
    }
}

/**
 * Проверяет, принадлежит ли филиал указанному бизнесу
 */
export async function checkBranchBelongsToBusiness(
    branchId: string,
    bizId: string
): Promise<{ belongs: boolean; error?: string }> {
    return checkResourceBelongsToBusiness('branches', branchId, bizId);
}

/**
 * Проверяет, принадлежит ли сотрудник указанному бизнесу
 */
export async function checkStaffBelongsToBusiness(
    staffId: string,
    bizId: string
): Promise<{ belongs: boolean; error?: string }> {
    return checkResourceBelongsToBusiness('staff', staffId, bizId);
}

/**
 * Проверяет, принадлежит ли услуга указанному бизнесу
 */
export async function checkServiceBelongsToBusiness(
    serviceId: string,
    bizId: string
): Promise<{ belongs: boolean; error?: string }> {
    return checkResourceBelongsToBusiness('services', serviceId, bizId);
}

/**
 * Проверяет, принадлежит ли бронирование указанному бизнесу
 */
export async function checkBookingBelongsToBusiness(
    bookingId: string,
    bizId: string
): Promise<{ belongs: boolean; error?: string }> {
    return checkResourceBelongsToBusiness('bookings', bookingId, bizId);
}

/**
 * Проверяет, принадлежит ли акция указанному бизнесу
 */
export async function checkPromotionBelongsToBusiness(
    promotionId: string,
    bizId: string
): Promise<{ belongs: boolean; error?: string }> {
    return checkResourceBelongsToBusiness('branch_promotions', promotionId, bizId);
}

/**
 * Проверяет, что все филиалы из списка принадлежат указанному бизнесу
 */
export async function checkBranchesBelongToBusiness(
    branchIds: string[],
    bizId: string
): Promise<{ allBelong: boolean; missing: string[]; error?: string }> {
    try {
        const admin = getServiceClient();
        const { data, error } = await admin
            .from('branches')
            .select('id, biz_id')
            .eq('biz_id', bizId)
            .in('id', branchIds);

        if (error) {
            logError('AuthCheck', 'Error checking branches', { error, branchIds, bizId });
            return { allBelong: false, missing: branchIds, error: error.message };
        }

        const found = new Set((data ?? []).map((r) => String(r.id)));
        const missing = branchIds.filter((id) => !found.has(String(id)));

        return { allBelong: missing.length === 0, missing };
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        logError('AuthCheck', 'Unexpected error checking branches', { error: errorMsg, branchIds, bizId });
        return { allBelong: false, missing: branchIds, error: errorMsg };
    }
}

