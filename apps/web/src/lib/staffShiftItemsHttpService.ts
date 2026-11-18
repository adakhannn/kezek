import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse, staffAccessErrorResponse } from '@/lib/apiErrorHandler';
import { determineErrorType, getIpAddress, logApiMetric } from '@/lib/apiMetrics';
import { logError } from '@/lib/log';
import { rateLimitDeniedResponse } from '@/lib/rateLimit';
import { runStaffShiftItemsRoute } from '@/lib/staffShiftItemsRouteService';

export async function runStaffShiftItemsHttp(req: Request): Promise<NextResponse> {
    const startTime = Date.now();
    const endpoint = '/api/staff/shift/items';
    let statusCode = 500;
    let staffId: string | undefined;
    let bizId: string | undefined;
    let userId: string | undefined;
    let errorMessage: string | undefined;

    try {
        const result = await runStaffShiftItemsRoute(req);

        if (!result.ok) {
            statusCode = result.status;
            errorMessage = result.message;
            staffId = result.metric?.staffId;
            bizId = result.metric?.bizId;
            userId = result.metric?.userId;

            logApiMetric({
                endpoint,
                method: 'POST',
                statusCode,
                durationMs: Date.now() - startTime,
                userId,
                staffId,
                bizId,
                errorMessage,
                errorType:
                    result.error === 'validation'
                        ? 'validation'
                        : determineErrorType(statusCode, errorMessage) || undefined,
                ipAddress: getIpAddress(req),
                userAgent: req.headers.get('user-agent') || undefined,
            }).catch(() => {});

            return result.rateLimit ? rateLimitDeniedResponse(result.rateLimit)
                : createErrorResponse(result.error, result.message, undefined, result.status);
        }

        statusCode = 200;
        staffId = result.metric.staffId;
        bizId = result.metric.bizId;
        userId = result.metric.userId;

        logApiMetric({
            endpoint,
            method: 'POST',
            statusCode,
            durationMs: Date.now() - startTime,
            userId,
            staffId,
            bizId,
            ipAddress: getIpAddress(req),
            userAgent: req.headers.get('user-agent') || undefined,
        }).catch(() => {});

        return createSuccessResponse(result.data);
    } catch (error) {
        // Staff card refusals (ARCH-02) are ordinary 400/403 answers, not server errors.
        const access = staffAccessErrorResponse(error);
        if (!access) logError('StaffShiftItems', 'Error saving shift items', error);
        errorMessage = access && error instanceof Error ? error.message : 'Ошибка при сохранении данных';
        statusCode = access ? access.status : 500;

        logApiMetric({
            endpoint,
            method: 'POST',
            statusCode,
            durationMs: Date.now() - startTime,
            userId,
            staffId,
            bizId,
            errorMessage,
            errorType: determineErrorType(statusCode, errorMessage) || undefined,
            ipAddress: getIpAddress(req),
            userAgent: req.headers.get('user-agent') || undefined,
        }).catch(() => {});

        return access ?? createErrorResponse('internal', errorMessage, undefined, 500);
    }
}
