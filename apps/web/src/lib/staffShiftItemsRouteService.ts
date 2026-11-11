import { getBizContextForManagers, getStaffContextForRequest } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { checkVerifiedPrincipalRateLimit, RateLimitConfigs, type RateLimitResult } from '@/lib/rateLimit';
import type { StaffContext } from '@/lib/staffRoleSync';
import { runSaveStaffShiftItems } from '@/lib/staffShiftItemsService';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { saveShiftItemsSchema } from '@/lib/validation/schemas';

type Success = {
    ok: true;
    data: { shiftId: string; revision: number; items: import('@/lib/validation/types').ShiftItem[] };
    metric: {
        staffId: string;
        bizId: string;
        userId?: string;
    };
};

type Failure = {
    ok: false;
    error: 'validation' | 'auth' | 'forbidden' | 'internal' | 'not_found' | 'rate_limit' | 'service_unavailable';
    message: string;
    status: number;
    rateLimit?: RateLimitResult;
    metric?: {
        staffId?: string;
        bizId?: string;
        userId?: string;
    };
};

export type StaffShiftItemsRouteResult = Success | Failure;

export async function runStaffShiftItemsRoute(req: Request): Promise<StaffShiftItemsRouteResult> {
    const validationResult = await validateRequest(req, saveShiftItemsSchema);
    if (!validationResult.success) {
        const errorResponse = await validationResult.response.json();
        const message = errorResponse.errors
            ? `Ошибка валидации: ${errorResponse.errors
                  .map((error: { path: string; message: string }) => `${error.path}: ${error.message}`)
                  .join(', ')}`
            : errorResponse.message || 'Ошибка валидации данных';

        return {
            ok: false,
            error: 'validation',
            message,
            status: 400,
        };
    }

    const { items, staffId: targetStaffId, shiftDate: targetShiftDate, expectedRevision, expectedShiftId } = validationResult.data;
    let supabase: StaffContext['supabase'];
    let staffId: string;
    let bizId: string;
    let userId: string | undefined;
    let isOwnerMode = false;
    let useServiceClient = false;

    if (targetStaffId) {
        const { supabase: managerSupabase, bizId: ctxBizId } = await getBizContextForManagers();
        supabase = managerSupabase;
        bizId = ctxBizId;
        useServiceClient = true;

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();
        userId = user?.id;
        if (userError || !user) {
            return {
                ok: false,
                error: 'auth',
                message: 'Не авторизован',
                status: 401,
                metric: { bizId },
            };
        }

        let adminForCheck = supabase;
        try {
            adminForCheck = getServiceClient();
        } catch {}

        const staffCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
            adminForCheck,
            'staff',
            targetStaffId,
            bizId,
            'id, biz_id',
        );

        if (staffCheck.error || !staffCheck.data) {
            return {
                ok: false,
                error: 'forbidden',
                message: 'Сотрудник не принадлежит этому бизнесу',
                status: 403,
                metric: {
                    staffId: targetStaffId,
                    bizId,
                    userId,
                },
            };
        }

        staffId = targetStaffId;
        isOwnerMode = true;
    } else {
        const context = await getStaffContextForRequest(req, 'StaffShiftItems');
        supabase = context.supabase;
        staffId = context.staffId;
        bizId = context.bizId;
        userId = context.userId;
    }

    const limit = await checkVerifiedPrincipalRateLimit(req, '/api/staff/shift/items', { userId: userId ?? '', bizId }, RateLimitConfigs.normal);
    if (!limit.success) return { ok: false, error: limit.unavailable ? 'service_unavailable' : 'rate_limit',
        message: limit.unavailable ? 'Проверка лимитов временно недоступна' : 'Превышен лимит запросов',
        status: limit.unavailable ? 503 : 429, rateLimit: limit, metric: { staffId, bizId, userId } };

    const result = await runSaveStaffShiftItems({
        supabase,
        staffId,
        bizId,
        actorId: userId ?? '',
        items,
        targetShiftDate,
        isOwnerMode,
        useServiceClient,
        expectedRevision,
        expectedShiftId,
    });

    if (!result.ok) {
        return {
            ok: false,
            error: result.errorType,
            message: result.message,
            status: result.statusCode,
            metric: {
                staffId,
                bizId,
                userId,
            },
        };
    }

    return {
        ok: true,
        data: result.data,
        metric: {
            staffId,
            bizId,
            userId,
        },
    };
}
