import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getRouteParamRequired } from '@/lib/routeParams';
import {
    updateDashboardShiftHours,
    type DashboardShiftHoursAdminLike,
} from '@/lib/dashboardStaffShiftUpdateHoursService';
import { withManagerContext } from '@/lib/withManagerContext';

type Body = {
    hours_worked: number;
};

export async function runDashboardStaffShiftUpdateHoursHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const shiftId = await getRouteParamRequired(context, 'id');

    return withManagerContext(req, 'UpdateShiftHours', async ({ admin, bizId }) => {
        let body: Body;
        try {
            body = await req.json();
        } catch {
            return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
        }

        const rawHours = Number(body.hours_worked);
        if (!Number.isFinite(rawHours) || rawHours < 0 || rawHours > 24 * 2) {
            return createErrorResponse(
                'validation',
                'Количество часов должно быть от 0 до 48',
                undefined,
                400,
            );
        }

        const hoursWorked = Math.round(rawHours * 100) / 100;

        const result = await updateDashboardShiftHours({
            admin: admin as unknown as DashboardShiftHoursAdminLike,
            bizId,
            shiftId,
            hoursWorked,
        });

        if (!result.ok) {
            return createErrorResponse(result.error, result.message, undefined, result.status);
        }

        return createSuccessResponse(result.data);
    });
}
