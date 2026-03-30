import type { SupabaseClient } from '@supabase/supabase-js';

import { getShiftData, buildFinanceResponsePayload } from '@/app/staff/finance/services/shiftDataService';
import { getBizContextForManagers, getStaffContext } from '@/lib/authBiz';
import { logDebug, logError } from '@/lib/log';
import { validateQuery } from '@/lib/validation/apiValidation';
import { staffFinanceQuerySchema } from '@/lib/validation/schemas';

type StaffFinanceRouteSuccess = {
    ok: true;
    data: ReturnType<typeof buildFinanceResponsePayload>;
    metric: {
        statusCode: 200;
        staffId: string;
        bizId: string;
        userId?: string;
        date: string | null;
        useServiceClient: boolean;
    };
};

type StaffFinanceRouteFailure = {
    ok: false;
    status: 400 | 401 | 404;
    error: 'validation' | 'auth' | 'not_found';
    message: string;
    metric?: {
        statusCode: 400 | 401 | 404;
        staffId?: string;
        bizId?: string;
        userId?: string;
        date?: string | null;
        useServiceClient?: boolean;
    };
};

export type StaffFinanceRouteResult = StaffFinanceRouteSuccess | StaffFinanceRouteFailure;

export async function runStaffFinanceRoute(req: Request): Promise<StaffFinanceRouteResult> {
    const url = new URL(req.url);
    const queryValidation = validateQuery(url, staffFinanceQuerySchema);
    if (!queryValidation.success) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Invalid query parameters',
            metric: {
                statusCode: 400,
            },
        };
    }

    const { staffId: staffIdParam, date: dateParam } = queryValidation.data;
    const targetDate = parseTargetDate(dateParam);

    let staffId: string;
    let bizId: string;
    let supabase: SupabaseClient;
    let useServiceClient = true;
    let userId: string | undefined;

    if (staffIdParam) {
        const context = await getBizContextForManagers();
        supabase = context.supabase;
        bizId = context.bizId;

        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, biz_id')
            .eq('id', staffIdParam)
            .maybeSingle();

        if (staffError) {
            logError('StaffFinanceRouteService', 'Error loading staff', {
                error: staffError.message,
                staffId: staffIdParam,
                bizId,
            });
            return {
                ok: false,
                status: 404,
                error: 'not_found',
                message: 'Сотрудник не найден или доступ запрещен',
                metric: {
                    statusCode: 404,
                    staffId: staffIdParam,
                    bizId,
                    date: dateParam ?? null,
                    useServiceClient: true,
                },
            };
        }

        if (!staff || normalizeId(staff.biz_id) !== normalizeId(bizId)) {
            if (staff && normalizeId(staff.biz_id) !== normalizeId(bizId)) {
                logError('StaffFinanceRouteService', 'Staff business mismatch', {
                    staffId: staffIdParam,
                    staffBizId: normalizeId(staff.biz_id),
                    requestedBizId: normalizeId(bizId),
                });
            } else {
                logDebug('StaffFinanceRouteService', 'Staff not found', {
                    staffId: staffIdParam,
                    bizId,
                });
            }

            return {
                ok: false,
                status: 404,
                error: 'not_found',
                message: 'Сотрудник не найден или доступ запрещен',
                metric: {
                    statusCode: 404,
                    staffId: staffIdParam,
                    bizId,
                    date: dateParam ?? null,
                    useServiceClient: true,
                },
            };
        }

        staffId = staffIdParam;
    } else {
        const context = await getStaffContext();
        supabase = context.supabase;
        staffId = context.staffId;
        bizId = context.bizId;
        const {
            data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id;
    }

    const result = await getShiftData({
        supabase,
        staffId,
        bizId,
        targetDate,
        useServiceClient,
    });

    return {
        ok: true,
        data: buildFinanceResponsePayload(result),
        metric: {
            statusCode: 200,
            staffId,
            bizId,
            userId,
            date: dateParam ?? null,
            useServiceClient,
        },
    };
}

function parseTargetDate(dateParam?: string) {
    if (!dateParam) {
        return new Date();
    }

    const [year, month, day] = dateParam.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function normalizeId(value: unknown) {
    return value == null ? null : String(value).trim();
}
