import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { updateDashboardShiftHours } from '@/lib/dashboardStaffShiftUpdateHoursService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';
const bodySchema = z.object({ hours_worked: z.number().finite().min(0).max(25), expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();
export async function runDashboardStaffShiftUpdateHoursHttp(req: Request, context: unknown): Promise<NextResponse> {
    const shiftId = await getRouteParamUuid(context, 'id');
    return withManagerContext(req, 'UpdateShiftHours', async ({ admin, bizId, userId }) => {
        let body: unknown;
        try { body = await req.json(); } catch { return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400); }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) return createErrorResponse('validation', 'Нужны часы (0–25) и версия исходной смены. Максимум часов зависит от локального дня.', undefined, 400);
        const result = await updateDashboardShiftHours({ admin, bizId, shiftId, actorId: userId,
            hoursWorked: Math.round(parsed.data.hours_worked * 100) / 100, expectedRevision: parsed.data.expectedRevision });
        if (!result.ok) return createErrorResponse(result.error, result.message, undefined, result.status);
        return createSuccessResponse(result.data);
    });
}
