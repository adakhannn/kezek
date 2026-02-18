export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

type ScheduleItem = {
    day_of_week: number;
    intervals: Array<{ start: string; end: string }>;
    breaks: Array<{ start: string; end: string }>;
};

type Body = {
    schedule: ScheduleItem[];
};

export async function POST(req: Request, context: unknown) {
    // Применяем rate limiting для обновления расписания филиала
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('BranchSchedule', async () => {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const branchId = await getRouteParamUuid(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = (await req.json()) as Body;

        // Проверяем, что филиал принадлежит бизнесу
        const { data: branch, error: branchError } = await admin
            .from('branches')
            .select('id, biz_id')
            .eq('id', branchId)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (branchError) {
            return createErrorResponse('validation', branchError.message, undefined, 400);
        }
        if (!branch) {
            return createErrorResponse('not_found', 'Филиал не найден', undefined, 404);
        }

        // Валидация расписания
        if (!Array.isArray(body.schedule)) {
            return createErrorResponse('validation', 'schedule должен быть массивом', undefined, 400);
        }

        // Удаляем старое расписание
        await admin.from('branch_working_hours').delete().eq('biz_id', bizId).eq('branch_id', branchId);

        // Вставляем новое расписание
        const inserts = body.schedule
            .filter((s) => s.intervals.length > 0) // Только рабочие дни
            .map((s) => ({
                biz_id: bizId,
                branch_id: branchId,
                day_of_week: s.day_of_week,
                intervals: s.intervals,
                breaks: s.breaks || [],
            }));

        if (inserts.length > 0) {
            const { error: insertError } = await admin.from('branch_working_hours').insert(inserts);
            if (insertError) {
                return createErrorResponse('validation', insertError.message, undefined, 400);
            }
        }

        return createSuccessResponse();
        })
    );
}

export async function GET(req: Request, context: unknown) {
    return withErrorHandler('BranchSchedule', async () => {
        const branchId = await getRouteParamUuid(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        // Проверяем, что филиал принадлежит бизнесу
        const { data: branch, error: branchError } = await admin
            .from('branches')
            .select('id, biz_id')
            .eq('id', branchId)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (branchError) {
            return createErrorResponse('validation', branchError.message, undefined, 400);
        }
        if (!branch) {
            return createErrorResponse('not_found', 'Филиал не найден', undefined, 404);
        }

        // Загружаем расписание
        const { data: schedule, error: scheduleError } = await admin
            .from('branch_working_hours')
            .select('day_of_week, intervals, breaks')
            .eq('biz_id', bizId)
            .eq('branch_id', branchId)
            .order('day_of_week');

        if (scheduleError) {
            return createErrorResponse('validation', scheduleError.message, undefined, 400);
        }

        return createSuccessResponse({ schedule: schedule || [] });
    });
}

